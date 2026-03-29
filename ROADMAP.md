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

## v1.3 — More Ecosystems (done)
- [x] `cargo` — Cargo.toml parser + crates.io API (downloads, versions, maintainers)
- [x] `go.mod` — go.mod parser + Go module proxy API (version/release dates)
- [x] `Gemfile` — Gemfile parser + RubyGems API (versions, downloads, source URLs)
- [x] 20 new parser tests (131 total)

## v1.4 — CI Integration (done)
- [x] GitHub Action: `uses: KidCarmi/Dependency-Obituary@main` — fails CI if any package scores below threshold
- [x] CLI tool: `node bin/check.js [file] --threshold 60` — local checks with colored terminal output
- [x] Auto-detects dependency files (package.json, requirements.txt, Cargo.toml, go.mod, Gemfile)
- [x] Example workflow: `.github/workflows/dependency-health.yml`

## v1.5 — Developer Ergonomics (done)
- [x] Badge API: `GET /api/badge?ecosystem=npm&package=react` returns SVG badge
- [x] Badge generator page at `/badge` — pick ecosystem, enter package, copy markdown
- [x] Link from landing page to badge generator
- [ ] VS Code extension — deferred (needs separate repo + marketplace publishing)
- [ ] API key system — deferred (requires auth, needs discussion per CLAUDE.md)

## v2.0 — Monitoring *(requires user discussion before building)*
- Opt-in project monitoring — saved package lists, weekly digest email
- GitHub App — automatic PR comments with health scores on dependency updates
