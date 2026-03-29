# CLAUDE.md — Dependency Obituary

Read this before writing a single line of code. This is the law.

---

## Project Context

**What this is:** A developer tool that parses `package.json` or `requirements.txt` and returns an objective health score for every dependency — detecting abandoned packages before they become a production problem.

**What this is NOT:**
- Not a security scanner (we don't replace Snyk or Dependabot)
- Not an AI chatbot
- Not a SaaS with accounts, billing, or stored user data

**Core promise to users:** Zero fake data. Every score is derived from objective, public API signals only. Never hallucinate, estimate, or fabricate package signals.

---

## TypeScript Rules

- `"strict": true` in `tsconfig.json`. Non-negotiable.
- No `any` — ever. Use `unknown` and narrow with type guards.
- All API response shapes must be typed with explicit interfaces. Never trust raw API responses.
- All function parameters and return types must be explicitly annotated.

```typescript
// NEVER
async function fetchPackage(name: any): Promise<any> { }

// ALWAYS
async function fetchPackage(name: string): Promise<PackageHealth> { }
```

---

## Error Handling Rules

Every external API call must handle all failure modes with a typed result union:

```typescript
type FetchResult<T> =
  | { success: true; data: T; cached: boolean; rateLimit: RateLimitState }
  | { success: false; error: "rate_limited" | "not_found" | "timeout" | "network_error"; retryAfter?: string }
```

Specific rules:
- GitHub 403 + `x-ratelimit-remaining: 0` → `rate_limited` → return degraded score
- GitHub 404 → `not_found` → return `risk_level: "unknown"` (absence of GitHub ≠ abandoned)
- Any fetch > 8 seconds → abort → `timeout` → return degraded score with cached data if available
- npm 404 → package does not exist → `not_found` → zero score
- **Never throw raw errors to the client. Never return HTTP 500.**

---

## Rate Limit Rules — Highest Priority

```typescript
// RULE 1: GITHUB_TOKEN is required. App must throw at startup if absent.
if (!process.env.GITHUB_TOKEN) throw new Error("GITHUB_TOKEN not set");

// RULE 2: Read x-ratelimit-remaining on EVERY GitHub response.
const remaining = parseInt(res.headers.get("x-ratelimit-remaining") ?? "0");

// RULE 3: Never let remaining drop below 100. Serve degraded results instead.
if (remaining < 100) return buildDegradedScore(pkg, "github_rate_limit");

// RULE 4: Never return HTTP 500 if rate limited. Always return partial results
//         with data_confidence: "unavailable" and retry_after timestamp.
```

---

## Concurrency Rules

Never fire unbounded `Promise.all()` over a package list.

```typescript
// NEVER — hammers the API, instant rate limit death
const results = await Promise.all(packages.map(fetchPackageHealth));

// ALWAYS — use the batched utility from lib/fetcher.ts
const results = await fetchBatched(packages);
```

`fetchBatched` signature:
```typescript
async function fetchBatched(
  packages: Package[],
  batchSize = 5,
  initialDelayMs = 200
): Promise<HealthScore[]>
```

---

## No Mock Data in Production

```typescript
// NEVER in production paths
const mockData = { stars: 1000, commits: 50 };

// ONLY behind env flag — never set in production
const data = process.env.USE_MOCK_DATA === "true" ? mockData : await fetchFromAPI();
```

CI must fail if `USE_MOCK_DATA=true` is set in any non-preview Vercel environment.

---

## File Structure

```
/
├── app/
│   ├── page.tsx                          # Landing + file upload UI
│   ├── results/page.tsx                  # Results dashboard
│   └── api/
│       ├── analyze/route.ts              # POST /api/analyze
│       └── cron/
│           └── refresh-popular/route.ts  # Nightly cache refresh
├── lib/
│   ├── parser.ts       # Client-side only. Parses package.json / requirements.txt
│   ├── fetcher.ts      # Batched fetching + adaptive throttle + cache read/write
│   ├── scorer.ts       # Health Score algorithm — pure functions ONLY
│   ├── cache.ts        # Upstash Redis wrapper with getOrFetch pattern
│   ├── github.ts       # GitHub API client with typed responses
│   └── npm.ts          # npm / PyPI API clients
├── types/
│   └── index.ts        # All shared TypeScript interfaces
├── data/
│   └── popular-packages.json   # Top 500 npm packages for nightly warming
└── CLAUDE.md
```

---

## Separation of Concerns — Hard Rules

| File | What it does | What it must NOT do |
|---|---|---|
| `scorer.ts` | Pure scoring functions only | API calls, Redis, side effects |
| `fetcher.ts` | Data retrieval + cache read/write | Scoring logic |
| `parser.ts` | Parse file content | Any network request — runs client-side only |
| `cache.ts` | Redis read/write abstraction | Business logic |
| `app/api/*/route.ts` | Orchestrate fetcher + scorer | Business logic, direct API calls |

`scorer.ts` must be **100% unit testable with zero mocks**. If you need to mock something to test scorer.ts, the architecture is wrong.

---

## Caching Pattern — Always Use This Exact Shape

```typescript
// lib/cache.ts
async function getOrFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number
): Promise<{ data: T; cached: boolean }> {
  const cached = await redis.get(key);
  if (cached) return { data: JSON.parse(cached as string), cached: true };

  const data = await fetcher();
  await redis.set(key, JSON.stringify(data), { ex: ttlSeconds });
  return { data, cached: false };
}
```

Rules:
- Cache keys: `dep:{ecosystem}:{package_name}:{major_version}`
- Never cache error states — only successful API responses
- Always return `cached: boolean` so the UI can show cache hit rate
- Never cache degraded results

---

## GitHub API — Approved Endpoints Only

Use only these endpoints. No others without explicit discussion:

| Data | Endpoint |
|---|---|
| Repo metadata | `GET /repos/{owner}/{repo}` |
| Last commit | `GET /repos/{owner}/{repo}/commits?per_page=1` |
| Contributors 90d | `GET /repos/{owner}/{repo}/stats/contributors` |
| Recent PRs | `GET /repos/{owner}/{repo}/pulls?state=closed&per_page=20` |
| CVEs | `GET /repos/{owner}/{repo}/security-advisories` |

**Resolve npm package → GitHub repo URL:**
1. Fetch `https://registry.npmjs.org/{package}` → parse `repository.url`
2. Strip `git+`, `.git`, convert `git://` → `https://`
3. No `repository` field → `github_url: null` → proceed with npm-only signals

---

## Scoring Engine Rules

- Formula defined in `SYSTEM_DESIGN.md`. Implement it exactly — do not change weights.
- Every signal scorer: `(value: number | null) => number`
- Every output: clamped to `[0, 100]`
- `null` input = use the "insufficient data" fallback score — never skip the signal
- `security_penalty` is a multiplier applied after the weighted sum

```typescript
// Correct null handling pattern
function scoreCommits(daysSinceLastCommit: number | null): number {
  if (daysSinceLastCommit === null) return 40; // insufficient data
  if (daysSinceLastCommit <= 30) return 100;
  if (daysSinceLastCommit <= 90) return 80;
  if (daysSinceLastCommit <= 180) return 55;
  if (daysSinceLastCommit <= 365) return 25;
  return 0;
}
```

---

## Environment Variables

```bash
# Required — app throws at startup without this
GITHUB_TOKEN=ghp_...

# Required — get from Upstash console
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...

# Development only — NEVER in production
USE_MOCK_DATA=false
```

---

## Testing Requirements

| Module | Coverage requirement |
|---|---|
| `scorer.ts` | 100% — pure functions, no excuses |
| `parser.ts` | Must handle: valid package.json, package.json with devDependencies, monorepo package.json, malformed JSON (must not throw) |
| `fetcher.ts` | Must mock: success, GitHub 403, GitHub 404, timeout > 8s |
| `cache.ts` | Must test: HIT, MISS, write failure |

No snapshot tests. Only explicit assertions on typed return values.

---

## Do Not Build Without Discussion

- User accounts or authentication
- Email capture or newsletters
- Paid tiers or paywalls
- LLM-generated alternative package suggestions
- Any analytics that identify individual users
- A backend database (Redis cache only, not a DB)
- Unauthenticated GitHub API calls (60 req/hr path is permanently closed)
