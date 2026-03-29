# Dependency Obituary

**Your dependencies are dying. You just don't know it yet.**

[![MIT License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Built with Next.js](https://img.shields.io/badge/built%20with-Next.js%2014-black)](https://nextjs.org)
[![Deployed on Vercel](https://img.shields.io/badge/deployed%20on-Vercel-black)](https://vercel.com)
[![Running cost](https://img.shields.io/badge/running%20cost-%240-brightgreen)](#tech-stack)

---

`npm audit` catches CVEs. Dependabot sends PRs. **Nothing catches abandonment.**

A maintainer went dark 14 months ago. Issues are stacking up. The last PR sat open for six months. Three CVEs were filed this year. Nobody is home.

**Dependency Obituary finds them first.**

---

## How it works

Drop your `package.json` or `requirements.txt`. Get back an honest health report for every dependency — scored on real signals, not opinions.

**No account. No install. No API key. Free forever.**

Your file never leaves your browser. We parse it client-side and only send package names and versions to the API.

---

## The Health Score

Every package gets a score from **0 (dead) to 100 (thriving)** based on public data:

| Signal | Weight | What it measures |
|---|---|---|
| Days since last commit | 25% | Is anyone working on this? |
| Days since last release | 20% | Are fixes reaching users? |
| Open issues ratio | 15% | Are problems being addressed? |
| Active contributors (90d) | 15% | Single point of failure? |
| PR merge velocity | 10% | How fast are contributions accepted? |
| Download trend | 10% | Is the ecosystem abandoning it? |
| Maintainer count | 5% | Bus factor |
| **Unresolved CVEs** | **Multiplier** | Security advisories tank the score |

No AI guessing. No vibes. Just numbers from GitHub and npm.

---

## Risk Levels

| Score | Status | What to do |
|---|---|---|
| 80-100 | Healthy | Ship it |
| 60-79 | Stable | Monitor annually |
| 40-59 | At risk | Plan a migration |
| 20-39 | Critical | Migrate this quarter |
| 0-19 | Abandoned | Stop. Migrate now. |

---

## Usage

### Web app

Visit **[dependency-obituary.vercel.app](https://dependency-obituary.vercel.app)** — drop your file, done.

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

### Self-host

**Prerequisites:** Node.js 18+, free [Upstash](https://upstash.com) Redis database, [GitHub PAT](https://github.com/settings/tokens) (read-only, no scopes needed)

```bash
git clone https://github.com/KidCarmi/Dependency-Obituary
cd Dependency-Obituary
npm install

cp .env.example .env.local
# Fill in GITHUB_TOKEN, UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN

npm run dev
# Open http://localhost:3000
```

---

## Tech Stack

| Layer | Technology | Cost |
|---|---|---|
| Frontend + API | Next.js 14 (App Router) | Free |
| Hosting | Vercel Hobby | Free |
| Cache | Upstash Redis | Free (10k cmds/day) |
| Package data | npm Registry / PyPI | Free |
| VCS data | GitHub REST API v3 | Free (5k req/hr) |
| **Total** | | **$0/month** |

---

## Architecture

```
Browser                              Server
  |                                    |
  |  [1] Parse file client-side        |
  |  [2] POST {ecosystem, packages}    |
  |  --------------------------------> |
  |                                    |  [3] Check Redis cache
  |                                    |  [4] Fetch npm/PyPI + GitHub (batched)
  |                                    |  [5] Score with pure functions
  |                                    |  [6] Cache results
  |  <-------------------------------- |
  |  [7] Render dashboard              |
```

**Key design decisions:**
- Adaptive throttle reads `x-ratelimit-remaining` and adjusts delay (200ms → 3000ms → stop)
- Shared cache across all users — the more users, the faster it gets
- Degraded results over errors — never returns 500, always returns partial data
- 111 tests passing (scorer at 100% coverage)

---

## Development

```bash
npm run dev          # Start dev server
npm run test         # Run 111 tests
npm run type-check   # TypeScript strict check
npm run build        # Production build
```

Read `CLAUDE.md` before writing code. It defines the strict rules:
- No `any` types
- No mock data in production
- `scorer.ts` must stay pure (zero side effects)
- Score formula weights are not open for debate

---

## FAQ

**Is this a replacement for `npm audit`?**
No. `npm audit` catches known CVEs. We catch abandonment — the slow death that security scanners miss. Use both.

**How accurate is the score?**
It's objective, not infallible. A feature-complete package may score low. We always show raw signals alongside the score — you apply the judgment.

**What if you hit GitHub's rate limit?**
The app degrades gracefully. You get partial results with an "unavailable" badge and a retry timestamp. Never a crash.

**What about private packages?**
Private packages return `risk_level: "unknown"` — we can't access private repos.

---

## License

MIT. Do whatever you want with it.

---

**Built in public. $0 to run. No VC. No bullshit.**
