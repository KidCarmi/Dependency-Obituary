# Dependency Obituary — Roadmap

## v1.x — Core (done)
- [x] 9 ecosystems: npm, PyPI, Cargo, Go, RubyGems, PHP, Java, Dart, C++
- [x] Scoring engine with null weight redistribution
- [x] Version-specific CVE filtering (only unpatched advisories count)
- [x] Score breakdown with actionable tooltips per signal
- [x] License detection (permissive/copyleft)
- [x] Export JSON/CSV + search/filter
- [x] Shareable report links
- [x] Chunked analysis for 350+ package files
- [x] Badge API + generator page
- [x] 152 unit tests + 42 integration tests

## v2.x — Platform (done)
- [x] GitHub OAuth (Auth.js v5, JWT sessions)
- [x] Watchlist dashboard with PR activity feed
- [x] Per-user GitHub tokens (5k req/hr per signed-in user)
- [x] Bot settings (thresholds, comment behavior)
- [x] Onboarding stepper
- [x] GitHub Action + CLI tool
- [x] GitHub App (auto PR comments)
- [x] Integrations page with install flow

## v2.5 — Scoring Accuracy (done)
- [x] Mature package detection (5 paths, zero fabricated data)
  - Path 1: Real downloads (npm, PyPI, Cargo, RubyGems, Packagist)
  - Path 2: deps.dev version count (Go)
  - Path 3: Repology distro count (C++)
  - Path 4: pub.dev popularity score (Dart)
  - Path 5: GitHub activity fallback (Maven)
- [x] Deprecated detection (npm `deprecated` field)
- [x] Archived detection (GitHub `archived` flag, score capped at 70)
- [x] has_issues guard (disabled issues != zero issues)
- [x] Staleness guard (5+ years no commits = not mature)
- [x] "Unmaintained" label (replaces misleading "Abandoned")
- [x] Allowlist (.depobituaryignore) with wildcard support

## v2.6 — Security & CI (done)
- [x] CodeQL SAST + Gitleaks secret scanning
- [x] OWASP ZAP DAST (weekly)
- [x] SSRF protection with URL allowlists
- [x] CSP, HSTS, Permissions-Policy, COEP, COOP headers
- [x] Input validation on all endpoints
- [x] Privacy Policy, Terms of Service, SECURITY.md
- [x] MIT License

---

## v3.0 — Dependency Intelligence (next)

### v3.1 — Transitive Dependency Detection
- [ ] Parse npm `package-lock.json` (direct vs transitive)
- [ ] Label each package as "direct" or "transitive" in results
- [ ] Show which direct dep pulls in each transitive dep
- [ ] Deprioritize transitive deps in CI failures
- [ ] Remediation hint: "transitive of X, add to .depobituaryignore"
- **Impact:** 5/5 — #1 user feedback item

### v3.2 — More Lock Files
- [ ] Parse `Cargo.lock`, `composer.lock`, `pubspec.lock`
- [ ] Parse `Gemfile.lock`
- [ ] Go: `go.mod` graph (go.sum is checksums only)
- **Impact:** 3/5 — extends transitive detection to more ecosystems

### v3.3 — Replacement Suggestions
- [ ] When package scores below 40, suggest maintained alternatives
- [ ] Show alternatives with their health scores (not editorial opinions)
- [ ] Curated JSON map for top 200 common replacements
- [ ] Expand with registry keyword matching
- **Impact:** 5/5 — "diagnosis to prescription"

---

## v4.0 — Growth

### v4.1 — Email Digest
- [ ] Weekly email if any watchlisted package degrades
- [ ] User-configurable threshold
- [ ] Integrate Resend (free tier)

### v4.2 — Historical Trend Tracking
- [ ] Score snapshots over time
- [ ] Sparkline charts on dashboard
- [ ] "React dropped 10 points this month"

### v4.3 — Slack / Discord Bot
- [ ] `/obituary-check react express`
- [ ] Team-level growth loop

### v4.4 — Public Trending Page
- [ ] Most analyzed packages
- [ ] Biggest score drops
- [ ] SEO landing pages per ecosystem

---

## v5.0 — Enterprise

### v5.1 — API Keys for CI/CD
- [ ] Generate keys on dashboard
- [ ] Authenticated endpoints with rate limits

### v5.2 — Custom Scoring Profiles
- [ ] Adjustable signal weights
- [ ] Presets: "Security-First", "Embedded Library"

### v5.3 — VS Code Extension
- [ ] Inline health scores in package.json
- [ ] Hover for score + risk + last commit

### v5.4 — Dependency Graph Visualization
- [ ] Interactive node-link diagram
- [ ] Nodes colored by risk level

---

## Competitive Position

| Feature | Us | Snyk | Socket.dev | Deps.dev |
|---|---|---|---|---|
| Maintenance health scoring | Yes | No | Partial | Partial |
| 9 ecosystems | Yes | Yes | npm only | Yes |
| Mature package detection | Yes | No | No | No |
| Transitive dep labels | **v3.0** | Yes | Yes | Yes |
| License detection | Yes | Yes | Yes | Yes |
| GitHub App (PR comments) | Yes | Yes | Yes | No |
| Free forever | Yes | Freemium | Freemium | Yes |
| Self-hostable | Yes | No | No | No |
| Privacy-first (client parse) | Yes | No | No | Yes |
| Zero fabricated data | Yes | N/A | N/A | Yes |
| Allowlist config | Yes | Yes | Yes | No |

---

*Last updated: v2.6 shipped. v3.0 (transitive deps) next.*
