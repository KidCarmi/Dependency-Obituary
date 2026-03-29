# Dependency Obituary — Roadmap

## v1.1 — Bug Fixes (current)
- Fix degraded result caching (first-run failures no longer lock for 12h)
- Fix Vercel timeout via concurrent batch processing
- Fix GitHub 202 handling for contributor stats (async computation)
- Fix npm_url preservation in degraded results

## v1.2 — Scoring Improvements
- Add GitHub closed issues count via search API (better issue_health_score)
- Handle GitHub stats 202 with a single retry (better contributor data)
- Show score confidence indicator per signal (high / low / unavailable)
- Add score explanation tooltip per signal in the results dashboard

## v1.3 — More Ecosystems
- `cargo` — Cargo.toml + crates.io API
- `go.mod` — pkg.go.dev API
- `Gemfile` — rubygems.org API

## v1.4 — CI Integration
- GitHub Action: `dependency-obituary-action` — fail CI if any package scores below threshold
- CLI tool: `npx dependency-obituary check` — local checks without the web UI

## v1.5 — Developer Ergonomics
- VS Code extension — inline health scores in `package.json`
- Badge generator — `![Health Score](https://dependency-obituary.vercel.app/badge/npm/react)` for READMEs
- Optional API key system — higher rate limits for CI usage

## v2.0 — Monitoring *(requires user discussion before building)*
- Opt-in project monitoring — saved package lists, weekly digest email
- GitHub App — automatic PR comments with health scores on dependency updates
