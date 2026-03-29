# SYSTEM_DESIGN.md — Dependency Obituary v2

## Overview

Dependency Obituary is a 100% client-side + serverless tool that analyzes open-source package health using public APIs. The architecture is designed for $0 operational cost forever, with a server-side GitHub PAT and adaptive throttling to safely handle any `package.json` size.

---

## Core Architecture Principles

1. **Files never leave the browser** — `package.json` / `requirements.txt` is parsed in the client. Only `{ name, version }[]` is sent to the API.
2. **Always authenticated** — every GitHub request uses a server-side PAT (`GITHUB_TOKEN`). The unauthenticated 60 req/hr path does not exist in this codebase.
3. **Cache-first, always** — Upstash Redis is checked before any external API call. Popular packages are permanently warm.
4. **Never return a 500** — rate limits, 404s, and timeouts all produce a typed degraded result, not an error.
5. **$0 forever** — Vercel Hobby + Upstash free tier covers all realistic traffic.

---

## Tech Stack

| Layer | Technology | Free Tier |
|---|---|---|
| Frontend + API | Next.js 14 (App Router) | Vercel Hobby |
| Hosting | Vercel | 100k invocations/month |
| Cache | Upstash Redis | 10k commands/day |
| Package data | npm Registry API | Unlimited |
| Python data | PyPI JSON API + pypistats.org | Unlimited |
| VCS data | GitHub REST API v3 (PAT) | 5,000 req/hr |
| Cron refresh | Vercel Cron | 2 jobs free |
| **Total cost** | | **$0/month** |

---

## Architecture Flow

```
User Browser
  │
  │  [1] Parse package.json / requirements.txt — 100% in JS, never sent to server
  │  [2] POST { ecosystem, packages: [{name, version}][] } → /api/analyze
  ▼
Next.js API Route — /api/analyze (Vercel Edge Function)
  │
  ├──► [3] Check Upstash Redis for each package
  │         HIT  → return cached HealthScore immediately (cached: true)
  │         MISS → proceed to adaptive throttle
  │
  ▼
Adaptive Throttle (lib/fetcher.ts)
  │  Batches of 5 · reads x-ratelimit-remaining after every batch
  │  Adjusts delay dynamically · stops if remaining < 100
  │
  ├──► GitHub REST API v3   (Authorization: Bearer GITHUB_TOKEN · 5,000 req/hr)
  └──► npm Registry / PyPI  (unlimited · no auth required)
  │
  ▼
Health Score Engine (lib/scorer.ts) — pure functions, zero side effects
  │
  ├──► Write result to Upstash Redis with dynamic TTL
  └──► Return typed HealthScore[] to client
```

---

## GitHub Authentication — Non-Negotiable

```typescript
// lib/github.ts — fails loudly at startup if token is missing
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

if (!GITHUB_TOKEN) {
  throw new Error(
    "[Dependency Obituary] GITHUB_TOKEN is not set. " +
    "Set it in Vercel environment variables or .env.local."
  );
}

export const GITHUB_HEADERS = {
  "Accept": "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "Authorization": `Bearer ${GITHUB_TOKEN}`,
} as const;
```

---

## Caching Strategy — Shared Population Cache

Every result is cached **globally across all users** in Upstash Redis.

### Cache Key Schema
```
dep:{ecosystem}:{package_name}:{major_version}

dep:npm:react:18
dep:npm:express:4
dep:pypi:requests:2
```

### Dynamic TTL by Popularity

| Weekly downloads | TTL |
|---|---|
| > 1M | 72 hours |
| 100k – 1M | 48 hours |
| 10k – 100k | 24 hours |
| < 10k | 12 hours |

### Cache Rules
- Successful scores → cached with dynamic TTL
- GitHub 404 (no repo) → cached as `risk_level: "unknown"`, TTL 12h
- Rate limit degraded → **never cached**
- Timeouts / network errors → **never cached**

---

## Adaptive Throttle

Reads `x-ratelimit-remaining` from every GitHub response header and adjusts:

| Remaining | Delay | Action |
|---|---|---|
| > 2,000 | 200ms | Full speed |
| 500 – 2,000 | 1,000ms | Cautious |
| 100 – 500 | 3,000ms | Critical crawl |
| < 100 | — | **Stop. Serve degraded results.** |

### Degraded Result — Never a 500

```typescript
{
  name: "some-obscure-package",
  version: "1.2.3",
  health_score: null,              // null = unscored, NOT zero
  risk_level: "unknown",
  data_confidence: "unavailable",
  reason: "github_rate_limit",
  retry_after: "2025-09-12T15:00:00Z"
}
```

---

## The Obituary Algorithm

### Weighted Formula
```
Health Score (0–100) = (
  commit_score         × 0.25
  release_score        × 0.20
  issue_health_score   × 0.15
  contributor_score    × 0.15
  pr_velocity_score    × 0.10
  download_trend_score × 0.10
  maintainer_score     × 0.05
) × security_penalty
```

All scoring functions are pure: `(value: number | null) => number`
All outputs clamped to [0, 100]. `null` = use defined fallback.

### Signal Scoring

**commit_score** (days since last commit)
```
null / unknown → 40
0–30   → 100 | 31–90  → 80 | 91–180 → 55 | 181–365 → 25 | >365 → 0
```

**release_score** (days since last release)
```
null → 40
0–60 → 100 | 61–180 → 75 | 181–365 → 40 | 366–730 → 10 | >730 → 0
```

**issue_health_score**
```
score = (1 - open_ratio) × 100  where open_ratio = open / (open + closed)
total_issues < 10 or null → 70 (insufficient data)
```

**contributor_score** (unique contributors, last 90 days)
```
null → 40 | 0 → 0 | 1 → 30 | 2–4 → 65 | 5–10 → 85 | >10 → 100
```

**pr_velocity_score** (avg days to merge last 20 PRs)
```
null / no PRs → 40
0–3 → 100 | 4–14 → 80 | 15–30 → 55 | 31–90 → 25 | >90 → 0
```

**download_trend_score** (current week vs 12 weeks ago)
```
null → 50
growing >10% → 100 | stable ±10% → 75 | declining 10–30% → 40 | declining >30% → 15
```

**maintainer_score**
```
>1 maintainer → 100 | 1 maintainer → 30 | null → 50
```

**security_penalty** (final multiplier)
```
0 CVEs → 1.00 | 1 CVE → 0.85 | 2–3 CVEs → 0.65 | >3 CVEs → 0.40
```

### Risk Classification

| Score | risk_level | Action |
|---|---|---|
| 80–100 | `healthy` | No action |
| 60–79 | `stable` | Monitor annually |
| 40–59 | `at_risk` | Plan migration in 6 months |
| 20–39 | `critical` | Migrate this quarter |
| 0–19 | `abandoned` | Migrate immediately |
| `null` | `unknown` | Retry after rate limit reset |

---

## API Contract

### POST /api/analyze

**Request:**
```typescript
{
  ecosystem: "npm" | "pypi",
  packages: Array<{ name: string; version: string }>
}
```

**Response:**
```typescript
{
  meta: {
    analyzed_at: string,
    cache_hit_rate: number,
    degraded_count: number,
    github_rate_limit: {
      remaining: number,
      used: number,
      reset_at: string
    }
  },
  results: Array<{
    name: string,
    version: string,
    health_score: number | null,
    risk_level: "healthy" | "stable" | "at_risk" | "critical" | "abandoned" | "unknown",
    data_confidence: "high" | "low" | "unavailable",
    reason?: "github_rate_limit" | "not_found" | "timeout",
    retry_after?: string,
    signals?: {
      days_since_last_commit: number | null,
      days_since_last_release: number | null,
      open_issues_ratio: number | null,
      contributor_count_90d: number | null,
      pr_merge_velocity_days: number | null,
      weekly_downloads: number | null,
      weekly_downloads_12w_ago: number | null,
      has_multiple_maintainers: boolean | null,
      unresolved_cves: number
    },
    github_url: string | null,
    npm_url: string | null
  }>
}
```

---

## Nightly Cache Warming

```json
// vercel.json
{
  "crons": [{
    "path": "/api/cron/refresh-popular",
    "schedule": "0 2 * * *"
  }]
}
```

Refreshes the top 500 most-queried packages nightly from `data/popular-packages.json`, ensuring popular packages are always cache-warm before users hit them.

---

## Security & Privacy

- No user data stored — Redis contains only package metadata
- Files never transmitted — parsing is 100% client-side
- IP rate limiting — max 5 req/min per IP via Upstash counters
- `GITHUB_TOKEN` never exposed to client

---

## Scalability Ceiling

| Metric | Free Tier | Expected at Launch |
|---|---|---|
| Vercel invocations | 100k/month | ~5k/month |
| Upstash commands | 10k/day | ~500 analyses/day |
| GitHub API | 5,000 req/hr | Covered by cache after warmup |

At viral scale (10k analyses/day, 70% cache hit rate): ~$18/month on Upstash paid tier. Still essentially free.
