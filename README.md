# ⚰️ Dependency Obituary

**Your dependencies are dying. You just don't know it yet.**

[![MIT License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Built with Next.js](https://img.shields.io/badge/built%20with-Next.js%2014-black)](https://nextjs.org)
[![Deployed on Vercel](https://img.shields.io/badge/deployed%20on-Vercel-black)](https://vercel.com)
[![Running cost](https://img.shields.io/badge/running%20cost-%240-brightgreen)](#tech-stack)
[![No account needed](https://img.shields.io/badge/account-none%20required-blue)](#usage)

---

`npm audit` catches CVEs.  
Dependabot sends PRs.  
**Nothing catches abandonment.**

Right now, somewhere in your `node_modules`, a maintainer went dark 14 months ago. Issues are stacking up with no response. The last PR sat open for six months before someone closed it without merging. Three CVEs were filed this year. Nobody is home.

You won't find out until something breaks in production at 2am.

**Dependency Obituary finds them first.**

---

## How it works

Drop your `package.json` or `requirements.txt`. Get back an honest, objective health report for every dependency — scored on real signals, not opinions.

**No account. No install. No API key. Free forever.**

Your file never leaves your browser. We parse it client-side and only send package names and versions to the API — never the raw file.

---

## The Health Score

Every package gets a score from **0 (dead) to 100 (thriving)** based entirely on public, objective data:

| Signal | Weight | What it actually measures |
|---|---|---|
| Days since last commit | 25% | Is anyone working on this? |
| Days since last release | 20% | Are fixes reaching users? |
| Open issues ratio | 15% | Are problems being addressed? |
| Active contributors (90d) | 15% | Single point of failure? |
| PR merge velocity | 10% | How fast do contributions get accepted? |
| Download trend | 10% | Is the ecosystem quietly abandoning it? |
| Maintainer count | 5% | Bus factor |
| **Unresolved CVEs** | **Multiplier** | Security advisories tank the score |

No AI guessing. No vibes. Just numbers from GitHub and npm.

---

## Risk Levels

| Score | Status | What to do |
|---|---|---|
| 80–100 | ✅ Healthy | Ship it |
| 60–79 | 🔵 Stable | Monitor annually |
| 40–59 | 🟡 At risk | Plan a migration |
| 20–39 | 🟠 Critical | Migrate this quarter |
| 0–19 | 🔴 Abandoned | Stop. Migrate now. |

---

## The Rate Limit Problem — and How We Solved It

GitHub's API is rate-limited. A cold `package.json` with 300 deps would drain a naive implementation in seconds.

We solved it two ways:

**1. Shared population cache.** Every result is cached globally across all users in Redis. When User A analyzes `react`, it's stored for 72 hours. When User B hits `react` 1 minute later — zero API calls, instant result. The more users, the faster it gets.

**2. Adaptive throttle.** We read `x-ratelimit-remaining` from every GitHub response header and adjust our request rate in real time. Above 2,000 remaining: full speed. Below 100: we stop fetching and return honest "unavailable" results with a retry timestamp — never a 500 error.

The app degrades gracefully. It never crashes.

---

## Usage

### Web app

Visit **[dependency-obituary.vercel.app](https://dependency-obituary.vercel.app)** — drop your file, done.

### Self-host in 5 minutes

**Prerequisites:** Node.js 18+, a free [Upstash](https://upstash.com) Redis database, a [GitHub PAT](https://github.com/settings/tokens) (read-only, no scopes needed)

```bash
git clone https://github.com/yourusername/dependency-obituary
cd dependency-obituary
npm install

cp .env.example .env.local
# Fill in:
#   GITHUB_TOKEN=ghp_...
#   UPSTASH_REDIS_REST_URL=https://...
#   UPSTASH_REDIS_REST_TOKEN=...

npm run dev
# Open http://localhost:3000
```

### API

```bash
curl -X POST https://dependency-obituary.vercel.app/api/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "ecosystem": "npm",
    "packages": [
      { "name": "express", "version": "4.18.2" },
      { "name": "left-pad", "version": "1.3.0" }
    ]
  }'
```

```json
{
  "meta": {
    "analyzed_at": "2025-09-12T14:30:00Z",
    "cache_hit_rate": 0.85,
    "degraded_count": 0,
    "github_rate_limit": { "remaining": 4203, "used": 797, "reset_at": "2025-09-12T15:00:00Z" }
  },
  "results": [
    {
      "name": "express",
      "health_score": 72,
      "risk_level": "stable",
      "signals": {
        "days_since_last_commit": 45,
        "contributor_count_90d": 8,
        "weekly_downloads": 34000000,
        "unresolved_cves": 0
      }
    },
    {
      "name": "left-pad",
      "health_score": 8,
      "risk_level": "abandoned",
      "signals": {
        "days_since_last_commit": 2847,
        "contributor_count_90d": 0,
        "weekly_downloads": 2100000,
        "unresolved_cves": 0
      }
    }
  ]
}
```

---

## Tech stack

| Layer | Technology | Cost |
|---|---|---|
| Frontend + API | Next.js 14 (App Router) | Free |
| Hosting | Vercel Hobby | Free |
| Cache | Upstash Redis | Free (10k cmds/day) |
| Package data | npm Registry API | Free |
| Python data | PyPI JSON API | Free |
| VCS data | GitHub REST API v3 | Free |
| **Total** | | **$0/month** |

---

## FAQ

**Is this a replacement for `npm audit` or Snyk?**
No. Those catch known CVEs. We catch *abandonment* — the slow, silent death that security scanners miss entirely. Use both.

**How accurate is the score?**
It's objective, not infallible. A package can score low because it's feature-complete, not dead. We always show raw signals alongside the score — you apply the judgment.

**Can I use this in CI?**
Yes. Hit the API directly. Decide your own threshold for what counts as a failing score.

**What about private packages?**
Private packages return `risk_level: "unknown"` — we can't access private GitHub repos.

**What if you hit GitHub's rate limit?**
The app gracefully degrades. You get partial results with an honest "unavailable" badge and a retry timestamp. Never a crash, never a 500.

---

## Roadmap

- [ ] VS Code extension — health scores inline in `package.json`
- [ ] GitHub Action — fail CI on abandoned dependencies  
- [ ] `cargo`, `go.mod`, `Gemfile` support
- [ ] Badge generator for your own README
- [ ] Weekly digest for monitored projects (opt-in only)

---

## Contributing

Read `CLAUDE.md` before writing code. It defines the strict rules for this codebase:

- No `any` types
- No mock data in production
- `scorer.ts` must stay pure functions only
- The Health Score formula weights are not open for debate — open an issue first

```bash
npm run test       # Must pass before any PR
npm run type-check # Zero errors required
```

---

## License

MIT. Do whatever you want with it.

---

**Built in public. $0 to run. No VC. No bullshit.**

*If this saved you from a 2am production incident, a star on the repo is the only currency we accept.*
