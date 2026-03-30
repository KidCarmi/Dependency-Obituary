# Dependency Obituary

**Your dependencies are dying. You just don't know it yet.**

[![MIT License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Built with Next.js](https://img.shields.io/badge/built%20with-Next.js%2016-black)](https://nextjs.org)
[![Deployed on Vercel](https://img.shields.io/badge/deployed%20on-Vercel-black)](https://vercel.com)
[![Running cost](https://img.shields.io/badge/running%20cost-%240-brightgreen)](#tech-stack)

---

`npm audit` catches CVEs. Dependabot sends PRs. **Nothing catches abandonment.**

A maintainer went dark 14 months ago. Issues are stacking up. The last PR sat open for six months. Three CVEs were filed this year. Nobody is home.

**Dependency Obituary finds them first.**

---

## How it works

Drop your dependency file. Get back an honest health report for every dependency — scored on real signals, not opinions.

**Supports:** `package.json` `requirements.txt` `Cargo.toml` `go.mod` `Gemfile`

**No account required. No install. No API key. Free forever.**

Your file never leaves your browser. We parse it client-side and only send package names to the API.

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

When a signal has no data (e.g. GitHub rate-limited), its weight is redistributed to signals with real data — no unfair penalties for missing API data.

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

Click any package row to see a full score breakdown with per-signal bars and explanations.

### CLI

```bash
# Auto-detects dependency file in current directory
node bin/check.js --threshold 60

# Explicit file + custom threshold
node bin/check.js Cargo.toml --threshold 40
```

### GitHub Action

```yaml
- uses: KidCarmi/Dependency-Obituary@main
  with:
    threshold: "60"    # Fail CI if any package scores below this
```

Triggers on PRs that change dependency files. See `.github/workflows/dependency-health.yml` for the full example.

### Badges

Add health score badges to your README:

```markdown
![Health Score](https://dependency-obituary.vercel.app/api/badge?ecosystem=npm&package=express)
```

![express](https://dependency-obituary.vercel.app/api/badge?ecosystem=npm&package=express)

Generate badges at [dependency-obituary.vercel.app/badge](https://dependency-obituary.vercel.app/badge).

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

Supported ecosystems: `npm`, `pypi`, `cargo`, `go`, `rubygems`

---

## Monitoring (optional, requires sign-in)

Sign in with GitHub to unlock:

- **Watchlist** — save dependency lists and re-check them from a dashboard
- **Better scores** — per-user GitHub tokens mean no shared rate limits

Anonymous file analysis works without sign-in. Auth is purely opt-in.

---

## Self-host

**Prerequisites:** Node.js 20+, [Upstash Redis](https://upstash.com) (free), [GitHub PAT](https://github.com/settings/tokens)

```bash
git clone https://github.com/KidCarmi/Dependency-Obituary
cd Dependency-Obituary
npm install

cp .env.example .env.local
# Required: GITHUB_TOKEN, UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
# Optional: AUTH_GITHUB_ID, AUTH_GITHUB_SECRET, AUTH_SECRET (for sign-in)

npm run dev
```

---

## Tech Stack

| Layer | Technology | Cost |
|---|---|---|
| Frontend + API | Next.js 16 (App Router) + React 19 | Free |
| Auth | Auth.js v5 (GitHub OAuth, JWT) | Free |
| Hosting | Vercel | Free |
| Cache | Upstash Redis | Free (10k cmds/day) |
| Package data | npm / PyPI / crates.io / Go proxy / RubyGems | Free |
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
  |                                    |  [3] Check Redis cache (v2: keys)
  |                                    |  [4] Fetch registry + GitHub (batched, concurrent)
  |                                    |  [5] Score with null weight redistribution
  |                                    |  [6] Cache non-degraded results
  |  <-------------------------------- |
  |  [7] Render dashboard + breakdown  |
```

**Key design decisions:**
- Concurrent batch processing (5 packages at a time via `Promise.all`)
- Adaptive throttle reads `x-ratelimit-remaining` and adjusts delay
- Null signal weights redistributed to signals with real data
- Never caches degraded results — stale entries auto-deleted on read
- Versioned cache keys (`v2:dep:...`) for algorithm changes
- 131 tests passing (scorer at 100% coverage)

---

## Development

```bash
npm run dev          # Start dev server
npm run test         # Run 131 tests
npm run type-check   # TypeScript strict check
npm run build        # Production build
```

---

## FAQ

**Is this a replacement for `npm audit`?**
No. `npm audit` catches known CVEs. We catch abandonment — the slow death that security scanners miss. Use both.

**What ecosystems are supported?**
npm (package.json), PyPI (requirements.txt), Cargo (Cargo.toml), Go (go.mod), RubyGems (Gemfile).

**How accurate is the score?**
It's objective, not infallible. We always show raw signals alongside the score — you apply the judgment. When GitHub data is unavailable, scores are based on registry data only.

**What if GitHub is rate-limited?**
The app degrades gracefully. Null signal weights are redistributed to available signals. Never a crash, never a 500.

---

## License

MIT. Do whatever you want with it.

---

**Built in public. $0 to run. No VC. No bullshit.**
