# Dependency Obituary — Roadmap

## v1.1 — Bug Fixes (done)
- [x] Fix degraded result caching (first-run failures no longer lock for 12h)
- [x] Fix Vercel timeout via concurrent batch processing
- [x] Fix GitHub 202 handling for contributor stats (async computation)
- [x] Fix npm_url preservation in degraded results
- [x] Fix JSON.parse on already-deserialized Redis cache hits
- [x] Skip and delete stale degraded cache entries on read

## v1.2 — Scoring Improvements (done)
- [x] Handle GitHub stats 202 with a single retry (better contributor data)
- [x] Show score confidence indicator per signal (high / low / unavailable)
- [x] Add score explanation tooltip per signal in the results dashboard
- [x] Add score breakdown bars (per-signal scores with weights)

## v1.3 — Multi-Ecosystem (done)
- [x] Cargo.toml + crates.io API
- [x] go.mod + Go module proxy API
- [x] Gemfile + RubyGems API
- [x] composer.json + Packagist API (PHP)
- [x] build.gradle + Maven Central API (Java/Kotlin)
- [x] pubspec.yaml + pub.dev API (Dart/Flutter)
- [x] 8 ecosystems total, 144 tests

## v1.4 — CI Integration (done)
- [x] GitHub Action: `uses: KidCarmi/Dependency-Obituary@main`
- [x] CLI tool: `node bin/check.js [file] --threshold 60`
- [x] Example workflow: `.github/workflows/dependency-health.yml`

## v1.5 — Developer Ergonomics (done)
- [x] Badge API + generator page
- [x] Shareable report links (30-day TTL, no auth needed)
- [x] Export JSON/CSV from results dashboard
- [x] Search/filter by package name and risk level
- [x] License detection (permissive/copyleft classification)
- [x] Chunked analysis for large files (350+ packages with progress bar)
- [x] Version tag in UI (NavBar + footer)

## v2.0 — Auth & Monitoring (done)
- [x] GitHub OAuth via Auth.js v5 (JWT sessions)
- [x] NavBar with sign-in / avatar dropdown
- [x] Watchlist dashboard (save/load/delete, max 20 projects)
- [x] Per-user GitHub tokens (5k req/hr per signed-in user)
- [x] Anonymous mode preserved for all core features

## v2.1 — Scoring Accuracy (done)
- [x] Null weight redistribution (missing signals don't drag scores down)
- [x] Version-specific CVE filtering (only unpatched advisories count)
- [x] Versioned cache keys (instant invalidation on algorithm changes)
- [x] Dep upgrades: Next.js 16, React 19, Auth.js v5, TS 6, Vitest 4

---

## v3.0 — Growth & Distribution

### v3.1 — GitHub App (viral loop)
- [ ] GitHub App registration + webhook handler
- [ ] Auto-comment on PRs that touch dependency files
- [ ] Comment includes risk summary + "View full report" link
- [ ] Comment updates on each push to the PR
- **Impact:** 5/5 — every PR reviewer sees the tool

### v3.2 — Email Digest
- [ ] Weekly/daily email if any watchlisted package degrades
- [ ] Integrate Resend (free tier: 100 emails/day)
- [ ] User-configurable threshold ("notify if score drops 10+ points")
- [ ] Direct link to dashboard in email
- **Impact:** 4/5 — drives stickiness, prevents silent degradation

### v3.3 — Slack / Discord Bot
- [ ] Slash command: `/obituary-check react express`
- [ ] File upload: bot analyzes and posts summary table
- [ ] Link to full report on web
- **Impact:** 4/5 — team-level growth loop

### v3.4 — Public Trending Page
- [ ] Track most-analyzed packages (7d/30d)
- [ ] Show biggest score drops, fastest risers
- [ ] "Healthiest emerging packages" (< 2 years old, score > 80)
- [ ] SEO landing pages per ecosystem
- **Impact:** 3/5 — drives organic traffic

---

## v4.0 — Enterprise & Power Users

### v4.1 — Historical Trend Tracking
- [ ] Store monthly score snapshots in Redis (`trend:{eco}:{name}:{YYYY-MM}`)
- [ ] Sparkline on watchlist cards
- [ ] Full 12-month chart with recharts
- [ ] Export trend as CSV
- **Impact:** 5/5 — enables proactive migration planning

### v4.2 — Scoring Explanations
- [ ] Actionable guidance per signal ("Score 25 → no commits in 180 days → consider pinning version")
- [ ] "What this means for you" section in expanded details
- [ ] Risk-specific recommendations (single maintainer, declining downloads, etc.)
- **Impact:** 3/5 — reduces confusion

### v4.3 — Dependency Relationships
- [ ] Parse lock files (package-lock.json, Cargo.lock, go.sum)
- [ ] Show direct vs transitive dependencies
- [ ] Highlight low-score transitive deps
- [ ] Dependency tree view
- **Impact:** 4/5 — reveals hidden risk

### v4.4 — API Keys for CI/CD
- [ ] Generate API keys on dashboard
- [ ] Authenticated API endpoints with rate limits
- [ ] Key rotation (90-day expiry)
- **Impact:** 3/5 — opens enterprise/regulated segment

### v4.5 — Custom Scoring Profiles
- [ ] Adjustable signal weights (sliders, must sum to 1.0)
- [ ] Presets: "Security-First", "Embedded Library", "High-Traffic App"
- [ ] Apply profiles to watchlist entries
- [ ] Compare default vs custom scores
- **Impact:** 3/5 — power user retention

---

## v5.0 — Platform

### v5.1 — VS Code Extension
- [ ] Inline health scores in package.json
- [ ] Hover over imports → score + risk + last commit
- [ ] Red highlights for critical/abandoned packages
- [ ] Click → open full report in browser
- **Impact:** 5/5 — embedded in developer workflow

### v5.2 — Advanced Security
- [ ] npm/PyPI native advisory feeds (beyond GitHub)
- [ ] Typosquatting detection (Levenshtein distance vs top 1000)
- [ ] Dependency confusion checks
- [ ] Age of last known vulnerability signal
- **Impact:** 4/5 — security is #1 enterprise driver

### v5.3 — Degradation Alerts & Webhooks
- [ ] Webhook URL per watchlist entry
- [ ] Nightly cron checks scores, fires webhook if threshold breached
- [ ] Payload: `{ event, package, old_score, new_score, risk_level }`
- [ ] Integrates with Datadog, PagerDuty, etc.
- **Impact:** 2/5 — enterprise niche

### v5.4 — Compare Dependencies
- [ ] Upload two files (e.g., main vs feature branch)
- [ ] Show: removed, added, changed packages with score deltas
- [ ] Summary: "net positive" or "net negative" change
- **Impact:** 2/5 — useful for PR reviews

### v5.5 — More IDPs & CI Platforms
- [ ] Azure AD, GitLab, Bitbucket sign-in
- [ ] Azure Pipelines task, GitLab CI template
- [ ] Bitbucket Pipelines pipe
- **Impact:** 3/5 — expands addressable market

---

## Competitive Position

| Feature | Us | Snyk | Socket.dev | Deps.dev |
|---|---|---|---|---|
| Abandonment detection | Yes | No | Partial | Partial |
| 8 ecosystems | Yes | Yes | npm only | Yes |
| License detection | Yes | Yes | Yes | Yes |
| Free forever | Yes | Freemium | Freemium | Yes |
| Self-hostable | Yes | No | No | No |
| GitHub Action | Yes | Yes | Yes | No |
| CLI tool | Yes | Yes | Yes | No |
| Badge generator | Yes | No | No | No |
| Shareable reports | Yes | No | No | No |
| Privacy-first (client-side parse) | Yes | No | No | Yes |
| $0 infrastructure | Yes | No | No | Yes |

---

*Last updated: v2.1 shipped. Launch ready.*
