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
