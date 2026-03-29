# CLAUDE.md — Dependency Obituary

Read this before writing a single line of code. This is the law.

---

## Project Context

**What this is:** A developer tool that parses `package.json` or `requirements.txt` and returns an objective health score for every dependency — detecting abandoned packages before they become a production problem.

**What this is NOT:** Not a security scanner, not an AI chatbot, not a SaaS with accounts/billing/stored user data.

**Core promise:** Zero fake data. Every score is derived from objective, public API signals only. Never fabricate package signals.

---

## TypeScript Rules

- `"strict": true` in `tsconfig.json`. Non-negotiable.
- No `any` — ever. Use `unknown` and narrow with type guards.
- All API response shapes must be typed with explicit interfaces.
- All function parameters and return types must be explicitly annotated.

---

## Error Handling

Every external API call uses the typed result union defined in `types/index.ts`:

```typescript
type FetchResult<T> =
  | { success: true; data: T; cached: boolean; rateLimit: RateLimitState }
  | { success: false; error: "rate_limited" | "not_found" | "timeout" | "network_error"; retryAfter?: string }
```

- GitHub 403 + remaining=0 → `rate_limited` → return degraded score
- GitHub 404 → `not_found` → `risk_level: "unknown"` (no GitHub ≠ abandoned)
- Any fetch > 8s → abort → `timeout` → degraded score
- npm 404 → `not_found` → zero score
- **Never throw raw errors. Never return HTTP 500.**

---

## Rate Limit Rules — Highest Priority

1. `GITHUB_TOKEN` required — app throws at startup if absent (`lib/github.ts`)
2. Read `x-ratelimit-remaining` on EVERY GitHub response
3. Never let remaining drop below 100 — serve degraded results instead
4. Never return HTTP 500 if rate limited — always return partial results with `data_confidence: "unavailable"`

---

## Concurrency Rules

Never fire unbounded `Promise.all()` over a package list. Always use `fetchBatched()` from `lib/fetcher.ts` (batches of 5, adaptive delay 200ms–3000ms based on rate limit state).

---

## File Structure

```
/
├── app/
│   ├── layout.tsx                        # Root layout
│   ├── page.tsx                          # Landing + file upload UI
│   ├── results/
│   │   └── ResultsDashboard.tsx          # Results dashboard component
│   └── api/
│       ├── analyze/route.ts              # POST /api/analyze
│       └── cron/refresh-popular/route.ts # Nightly cache refresh
├── lib/
│   ├── parser.ts       # Client-side only. Parses package.json / requirements.txt
│   ├── fetcher.ts      # Batched fetching + adaptive throttle + cache read/write
│   ├── scorer.ts       # Health Score algorithm — pure functions ONLY
│   ├── cache.ts        # Upstash Redis wrapper with getOrFetch pattern
│   ├── github.ts       # GitHub API client with typed responses
│   ├── npm.ts          # npm / PyPI API clients
│   └── __tests__/      # Vitest test files
├── types/
│   └── index.ts        # All shared TypeScript interfaces
├── data/
│   └── popular-packages.json   # Top 100 npm packages for nightly warming
└── CLAUDE.md
```

---

## Separation of Concerns — Hard Rules

| File | Does | Must NOT do |
|---|---|---|
| `scorer.ts` | Pure scoring functions | API calls, Redis, side effects |
| `fetcher.ts` | Data retrieval + cache | Scoring logic |
| `parser.ts` | Parse file content | Network requests (client-side only) |
| `cache.ts` | Redis read/write | Business logic |
| `api/*/route.ts` | Orchestrate fetcher + scorer | Direct API calls, business logic |

`scorer.ts` must be **100% unit testable with zero mocks**.

---

## Caching

Uses `getOrFetch<T>()` from `lib/cache.ts` with Upstash Redis:
- Cache keys: `dep:{ecosystem}:{package_name}:{major_version}`
- Dynamic TTL: 72h (>1M dl/wk), 48h (100k–1M), 24h (10k–100k), 12h (<10k)
- Never cache error states or degraded results
- Always return `cached: boolean` for UI hit rate display

---

## GitHub API — Approved Endpoints Only

| Data | Endpoint |
|---|---|
| Repo metadata | `GET /repos/{owner}/{repo}` |
| Last commit | `GET /repos/{owner}/{repo}/commits?per_page=1` |
| Contributors 90d | `GET /repos/{owner}/{repo}/stats/contributors` |
| Recent PRs | `GET /repos/{owner}/{repo}/pulls?state=closed&per_page=20` |
| CVEs | `GET /repos/{owner}/{repo}/security-advisories` |

Resolve npm → GitHub: fetch registry, parse `repository.url`, strip `git+`/`.git`. No repo field → `github_url: null` → npm-only signals.

---

## Scoring Engine

Formula defined in `SYSTEM_DESIGN.md` — do not change weights:

| Signal | Weight | Null fallback |
|---|---|---|
| commit_score | 0.25 | 40 |
| release_score | 0.20 | 40 |
| issue_health_score | 0.15 | 70 |
| contributor_score | 0.15 | 40 |
| pr_velocity_score | 0.10 | 40 |
| download_trend_score | 0.10 | 50 |
| maintainer_score | 0.05 | 50 |

`security_penalty` is a multiplier applied after the weighted sum. All outputs clamped to [0, 100].

---

## Environment Variables

```bash
GITHUB_TOKEN=ghp_...                    # Required — throws at startup
UPSTASH_REDIS_REST_URL=https://...      # Required
UPSTASH_REDIS_REST_TOKEN=...            # Required
USE_MOCK_DATA=false                     # Dev only — NEVER in production
```

---

## Testing (Vitest)

| Module | Requirement |
|---|---|
| `scorer.ts` | 100% coverage — pure functions, no mocks |
| `parser.ts` | All formats: package.json, requirements.txt, Cargo.toml, go.mod, Gemfile |
| `fetcher.ts` | Mock: success, GitHub 403, GitHub 404, timeout > 8s |
| `cache.ts` | Test: HIT, MISS, write failure |

No snapshot tests. Only explicit assertions on typed return values.

Run: `npm run test` (131 tests passing)

---

## Do Not Build Without Discussion

- User accounts or authentication
- Email capture or newsletters
- Paid tiers or paywalls
- LLM-generated suggestions
- User-identifying analytics
- A backend database (Redis cache only)
- Unauthenticated GitHub API calls
