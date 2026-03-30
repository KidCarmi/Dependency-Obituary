# CLAUDE.md -Dependency Obituary

Read this before writing a single line of code. This is the law.

---

## Project Context

**What this is:** A developer tool that parses dependency files (package.json, requirements.txt, Cargo.toml, go.mod, Gemfile, composer.json, build.gradle, pubspec.yaml) and returns an objective health score for every dependency - detecting abandoned packages before they become a production problem.

**What this is NOT:** Not a security scanner, not an AI chatbot. Auth is optional (GitHub OAuth for monitoring features).

**Core promise:** Zero fake data. Every score is derived from objective, public API signals only. Never fabricate package signals.

---

## TypeScript Rules

- `"strict": true` in `tsconfig.json`. Non-negotiable.
- No `any` - ever. Use `unknown` and narrow with type guards.
- All API response shapes must be typed with explicit interfaces.

---

## Error Handling

Every external API call uses the typed result union in `types/index.ts`:

```typescript
type FetchResult<T> =
  | { success: true; data: T; cached: boolean; rateLimit: RateLimitState }
  | { success: false; error: "rate_limited" | "not_found" | "timeout" | "network_error"; retryAfter?: string }
```

- GitHub 403 + remaining=0 → `rate_limited` → degraded score
- GitHub 404 → `not_found` → `risk_level: "unknown"`
- GitHub 202 → retry once after 1s (stats computing)
- Any fetch > 8s → abort → `timeout`
- **Never throw raw errors. Never return HTTP 500.**

---

## Rate Limit & Concurrency

1. `GITHUB_TOKEN` required - throws at startup if absent
2. Read `x-ratelimit-remaining` on EVERY GitHub response
3. Never let remaining < 100 - serve degraded results
4. Batched processing via `fetchBatched()` (batch size 5, concurrent within batch)
5. Adaptive delay: 200ms → 1000ms → 3000ms → stop based on remaining

---

## File Structure

```
/
├── app/
│   ├── layout.tsx, providers.tsx, NavBar.tsx
│   ├── page.tsx                           # Landing + file upload
│   ├── results/ResultsDashboard.tsx       # Results with score breakdown
│   ├── badge/page.tsx                     # Badge generator
│   ├── dashboard/page.tsx                 # Watchlist dashboard (auth)
│   └── api/
│       ├── analyze/route.ts               # POST /api/analyze
│       ├── badge/route.ts                 # GET /api/badge (SVG)
│       ├── cache/route.ts                 # DELETE /api/cache (flush)
│       ├── watchlist/route.ts             # CRUD watchlist (auth)
│       ├── auth/[...nextauth]/route.ts    # Auth.js v5
│       └── cron/refresh-popular/route.ts  # Nightly cache refresh
├── lib/
│   ├── auth.ts        # Auth.js v5 config (GitHub OAuth, JWT)
│   ├── parser.ts      # Client-side: package.json, requirements.txt, Cargo.toml, go.mod, Gemfile, composer.json, build.gradle, pubspec.yaml
│   ├── fetcher.ts     # Batched fetch + cache (npm, PyPI, crates.io, Go proxy, RubyGems)
│   ├── scorer.ts      # Health Score -pure functions, null weight redistribution
│   ├── cache.ts       # Upstash Redis wrapper, versioned keys (v2:dep:...)
│   ├── github.ts      # GitHub API client (202 retry on contributors)
│   ├── npm.ts         # npm / PyPI / crates.io / Go proxy / RubyGems clients
│   └── __tests__/     # Vitest test files
├── bin/
│   └── check.js       # CLI tool: node bin/check.js [file] --threshold 60
├── types/index.ts     # All shared TypeScript interfaces
├── action.yml         # GitHub Action definition
└── CLAUDE.md
```

---

## Separation of Concerns

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

- Versioned cache keys: `v2:dep:{ecosystem}:{name}:{major_version}`
- Dynamic TTL: 72h (>1M dl/wk), 48h (100k–1M), 24h (10k–100k), 12h (<10k)
- Never cache degraded results (`data_confidence: "unavailable"`)
- Skip + delete stale degraded entries on read

---

## Scoring Engine

Weights (do not change):

| Signal | Weight | Null fallback |
|---|---|---|
| commit_score | 0.25 | 40 |
| release_score | 0.20 | 40 |
| issue_health_score | 0.15 | 70 |
| contributor_score | 0.15 | 40 |
| pr_velocity_score | 0.10 | 40 |
| download_trend_score | 0.10 | 50 |
| maintainer_score | 0.05 | 50 |

**Null weight redistribution:** When a signal has no data, its weight is redistributed proportionally to signals with real data. This prevents rate-limited GitHub data from dragging scores down.

`security_penalty` is a multiplier applied after the weighted sum. All outputs clamped to [0, 100].

---

## Environment Variables

```bash
GITHUB_TOKEN=ghp_...                    # Required - throws at startup
UPSTASH_REDIS_REST_URL=https://...      # Required
UPSTASH_REDIS_REST_TOKEN=...            # Required
AUTH_GITHUB_ID=...                      # Optional -GitHub OAuth
AUTH_GITHUB_SECRET=...                  # Optional -GitHub OAuth
AUTH_SECRET=...                         # Required if auth enabled
```

---

## Testing (Vitest)

| Module | Requirement |
|---|---|
| `scorer.ts` | 100% coverage - pure functions, no mocks |
| `parser.ts` | All formats: package.json, requirements.txt, Cargo.toml, go.mod, Gemfile, composer.json, build.gradle, pubspec.yaml |
| `cache.ts` | Test: HIT, MISS, versioned keys |

Run: `npm run test` (144 tests passing)

---

## GitHub App Integration

The GitHub App auto-comments health reports on PRs that touch dependency files.

**Webhook:** `POST /api/github/webhook` -verifies signature, fetches changed files, analyzes, posts comment.

**Auth flow:** JWT (RS256 with private key) → installation access token (1hr, cached).

**Activity logging:** Events stored in Redis (`feed:{installation_id}`, capped at 100).

**Env vars:**
```bash
GITHUB_APP_ID=123456                    # App ID from GitHub App settings
GITHUB_APP_PRIVATE_KEY="-----BEGIN..."  # PEM private key
GITHUB_WEBHOOK_SECRET=...               # Webhook secret for signature verification
```
