/**
 * fetcher.ts — Batched Fetching + Adaptive Throttle
 *
 * RULES (enforced by CLAUDE.md):
 *  - Never fire unbounded Promise.all() over a package list
 *  - Use fetchBatched with batchSize=5, initialDelayMs=200
 *  - Read x-ratelimit-remaining after every batch
 *  - Stop if remaining < 100 → serve degraded results
 *  - Never throw — always return typed results
 *  - No scoring logic here — only data retrieval + cache orchestration
 */

import type {
  Ecosystem,
  Package,
  HealthResult,
  PackageSignals,
  RateLimitState,
  SignalsResponse,
  GitHubCommit,
  GitHubContributor,
  GitHubPullRequest,
  GitHubSecurityAdvisory,
  GitHubRepoMetadata,
  NpmPackageData,
  PyPIPackageData,
} from "@/types";
import { buildCacheKey, getDynamicTTL, redis } from "@/lib/cache";
import {
  fetchRepoMetadata,
  fetchLastCommit,
  fetchContributors,
  fetchRecentPRs,
  fetchSecurityAdvisories,
  parseGitHubUrl,
} from "@/lib/github";
import {
  fetchNpmPackage,
  fetchNpmDownloads,
  fetchNpmDownloads12wAgo,
  fetchPyPIPackage,
  fetchPyPIDownloads,
  fetchCratesIoPackage,
  fetchCratesIoDownloads,
  fetchGoModule,
  fetchRubyGem,
  fetchRubyGemVersions,
  extractGitHubUrl,
  extractGitHubUrlFromGoModule,
  isGitHubHostname,
  fetchPackagistPackage,
  fetchMavenPackage,
  fetchPubPackage,
  fetchVcpkgPort,
  fetchVcpkgVersions,
  fetchRepologyProject,
  fetchPubPackageScore,
  fetchDepsDevPackage,
} from "@/lib/npm";
import type { MavenSearchResult } from "@/lib/npm";
import { scorePackage, isMaturePackage } from "@/lib/scorer";

// ─── Adaptive Delay ─────────────────────────────────────────────────────────

function getAdaptiveDelay(remaining: number, initialDelayMs: number): number {
  if (remaining > 2000) return initialDelayMs;   // Full speed
  if (remaining > 500) return 1000;               // Cautious
  if (remaining > 100) return 3000;               // Critical crawl
  return -1;                                      // Stop
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Download Aggregation (crates.io daily → weekly) ───────────────────────

function aggregateDownloads(
  downloads: Array<{ date: string; downloads: number }>,
  daysAgoStart: number,
  daysAgoEnd: number
): number | null {
  const now = Date.now();
  const startMs = now - daysAgoEnd * 24 * 3600 * 1000;
  const endMs = now - daysAgoStart * 24 * 3600 * 1000;

  let total = 0;
  let found = false;

  for (const d of downloads) {
    const t = new Date(d.date).getTime();
    if (t >= startMs && t < endMs) {
      total += d.downloads;
      found = true;
    }
  }

  return found ? total : null;
}

// ─── Degraded Result Builder ────────────────────────────────────────────────

function buildDegradedResult(
  pkg: Package,
  reason: "github_rate_limit" | "not_found" | "timeout",
  retryAfter?: string,
  npmUrl?: string | null
): HealthResult {
  return {
    name: pkg.name,
    version: pkg.version,
    health_score: null,
    risk_level: "unknown",
    data_confidence: "unavailable",
    reason,
    retry_after: retryAfter,
    github_url: null,
    npm_url: npmUrl ?? null,
  };
}

// ─── Signal Builder ─────────────────────────────────────────────────────────

interface GitHubData {
  metadata: GitHubRepoMetadata | null;
  lastCommit: GitHubCommit[] | null;
  contributors: GitHubContributor[] | null;
  recentPRs: GitHubPullRequest[] | null;
  advisories: GitHubSecurityAdvisory[] | null;
}

interface RegistryData {
  weeklyDownloads: number | null;
  weeklyDownloads12wAgo: number | null;
  hasMultipleMaintainers: boolean | null;
  daysSinceLastRelease: number | null;
  license: string | null;
  isDeprecated: boolean;
}

function buildSignals(
  github: GitHubData,
  registry: RegistryData
): PackageSignals {
  // Days since last commit
  let daysSinceLastCommit: number | null = null;
  if (github.lastCommit && github.lastCommit.length > 0) {
    const commitDate = github.lastCommit[0].commit.committer?.date;
    if (commitDate) {
      daysSinceLastCommit = Math.floor(
        (Date.now() - new Date(commitDate).getTime()) / (1000 * 3600 * 24)
      );
    }
  }

  // Open/closed issues
  let openIssues: number | null = null;
  let closedIssues: number | null = null;
  if (github.metadata) {
    // Guard: if issues are disabled, don't count 0 as "no issues"
    if (github.metadata.has_issues) {
      openIssues = github.metadata.open_issues_count;
    }
    closedIssues = null;
  }

  // Contributors in last 90 days
  let contributorCount90d: number | null = null;
  if (github.contributors) {
    const now = Date.now();
    const ninetyDaysAgo = now - 90 * 24 * 3600 * 1000;
    const ninetyDaysAgoWeek = Math.floor(ninetyDaysAgo / 1000);

    contributorCount90d = github.contributors.filter((c) => {
      if (!c.weeks || c.weeks.length === 0) return false;
      return c.weeks.some((w) => w.w >= ninetyDaysAgoWeek && w.c > 0);
    }).length;
  }

  // PR merge velocity (avg days to merge last 20 closed PRs)
  let prMergeVelocityDays: number | null = null;
  if (github.recentPRs) {
    const mergedPRs = github.recentPRs.filter((pr) => pr.merged_at !== null);
    if (mergedPRs.length > 0) {
      const totalDays = mergedPRs.reduce((sum, pr) => {
        const created = new Date(pr.created_at).getTime();
        const merged = new Date(pr.merged_at!).getTime();
        return sum + (merged - created) / (1000 * 3600 * 24);
      }, 0);
      prMergeVelocityDays = totalDays / mergedPRs.length;
    }
  }

  // Unresolved CVEs — only count advisories with NO patch available
  // Advisories with patched_versions mean a fix exists; users can upgrade.
  // Only truly unpatched vulnerabilities should tank the score.
  let unresolvedCves = 0;
  if (github.advisories) {
    unresolvedCves = github.advisories.filter((a) => {
      if (a.state === "closed" || a.state === "withdrawn") return false;
      // If all vulnerabilities in this advisory have patches, it's resolved
      if (a.vulnerabilities && a.vulnerabilities.length > 0) {
        const allPatched = a.vulnerabilities.every(
          (v) => v.patched_versions !== null && v.patched_versions !== undefined
        );
        if (allPatched) return false;
      }
      return true;
    }).length;
  }

  return {
    daysSinceLastCommit,
    daysSinceLastRelease: registry.daysSinceLastRelease,
    openIssues,
    closedIssues,
    contributorCount90d,
    prMergeVelocityDays,
    weeklyDownloads: registry.weeklyDownloads,
    weeklyDownloads12wAgo: registry.weeklyDownloads12wAgo,
    hasMultipleMaintainers: registry.hasMultipleMaintainers,
    unresolvedCves,
  };
}

function buildSignalsResponse(signals: PackageSignals, registry: RegistryData): SignalsResponse {
  return {
    days_since_last_commit: signals.daysSinceLastCommit,
    days_since_last_release: signals.daysSinceLastRelease,
    open_issues_ratio:
      signals.openIssues !== null && signals.closedIssues !== null
        ? signals.openIssues /
          (signals.openIssues + signals.closedIssues || 1)
        : null,
    contributor_count_90d: signals.contributorCount90d,
    pr_merge_velocity_days: signals.prMergeVelocityDays
      ? Math.round(signals.prMergeVelocityDays * 10) / 10
      : null,
    weekly_downloads: signals.weeklyDownloads,
    weekly_downloads_12w_ago: signals.weeklyDownloads12wAgo,
    has_multiple_maintainers: signals.hasMultipleMaintainers,
    unresolved_cves: signals.unresolvedCves,
    license: registry.license,
    is_mature: isMaturePackage(signals),
    is_deprecated: registry.isDeprecated,
    is_archived: false,
  };
}

// ─── Single Package Fetcher ─────────────────────────────────────────────────

interface FetchPackageResult {
  result: HealthResult;
  rateLimit: RateLimitState | null;
}

async function fetchPackageHealth(
  pkg: Package,
  ecosystem: Ecosystem,
  githubToken?: string
): Promise<FetchPackageResult> {
  let latestRateLimit: RateLimitState | null = null;

  try {
    // Step 1: Fetch registry data
    let githubUrl: string | null = null;
    let registryData: RegistryData = {
      weeklyDownloads: null,
      weeklyDownloads12wAgo: null,
      hasMultipleMaintainers: null,
      daysSinceLastRelease: null,
      license: null,
      isDeprecated: false,
    };
    let npmUrl: string | null = null;

    if (ecosystem === "npm") {
      const [pkgResult, dlResult, dl12wResult] = await Promise.all([
        fetchNpmPackage(pkg.name),
        fetchNpmDownloads(pkg.name),
        fetchNpmDownloads12wAgo(pkg.name),
      ]);

      if (!pkgResult.success) {
        return {
          result: buildDegradedResult(pkg, pkgResult.error === "not_found" ? "not_found" : "timeout"),
          rateLimit: null,
        };
      }

      npmUrl = `https://www.npmjs.com/package/${pkg.name}`;
      githubUrl = extractGitHubUrl(pkgResult.data);

      // Extract license — check top-level first, then latest version
      let npmLicense: string | { type?: string } | undefined = pkgResult.data.license;
      if (!npmLicense && pkgResult.data["dist-tags"]?.latest && pkgResult.data.versions) {
        const latestVer = pkgResult.data["dist-tags"].latest;
        npmLicense = pkgResult.data.versions[latestVer]?.license;
        // Check if latest version is deprecated
        if (pkgResult.data.versions[latestVer]?.deprecated) {
          registryData.isDeprecated = true;
        }
      }
      registryData.license = typeof npmLicense === "string"
        ? npmLicense
        : typeof npmLicense === "object" && npmLicense !== null && "type" in npmLicense
          ? (npmLicense.type ?? null)
          : null;

      registryData.weeklyDownloads = dlResult.success
        ? dlResult.data.downloads
        : null;
      registryData.weeklyDownloads12wAgo = dl12wResult.success
        ? dl12wResult.data.downloads
        : null;
      registryData.hasMultipleMaintainers =
        pkgResult.data.maintainers
          ? pkgResult.data.maintainers.length > 1
          : null;

      // Days since last release from npm time field
      if (pkgResult.data.time && pkgResult.data["dist-tags"]?.latest) {
        const latestVersion = pkgResult.data["dist-tags"].latest;
        const releaseDate = pkgResult.data.time[latestVersion];
        if (releaseDate) {
          registryData.daysSinceLastRelease = Math.floor(
            (Date.now() - new Date(releaseDate).getTime()) / (1000 * 3600 * 24)
          );
        }
      }
    } else if (ecosystem === "pypi") {
      const [pkgResult, dlResult] = await Promise.all([
        fetchPyPIPackage(pkg.name),
        fetchPyPIDownloads(pkg.name),
      ]);

      if (!pkgResult.success) {
        return {
          result: buildDegradedResult(pkg, pkgResult.error === "not_found" ? "not_found" : "timeout"),
          rateLimit: null,
        };
      }

      npmUrl = `https://pypi.org/project/${pkg.name}`;
      githubUrl = extractGitHubUrl(pkgResult.data);
      registryData.license = pkgResult.data.info.license ?? null;

      registryData.weeklyDownloads = dlResult.success
        ? dlResult.data.data.last_week
        : null;
      registryData.hasMultipleMaintainers =
        pkgResult.data.info.maintainer !== null &&
        pkgResult.data.info.author !== null
          ? pkgResult.data.info.maintainer !== pkgResult.data.info.author
          : null;

      // Days since last release
      const releases = Object.values(pkgResult.data.releases).flat();
      if (releases.length > 0) {
        const latestUpload = releases.reduce((latest, r) => {
          const t = new Date(r.upload_time).getTime();
          return t > latest ? t : latest;
        }, 0);
        registryData.daysSinceLastRelease = Math.floor(
          (Date.now() - latestUpload) / (1000 * 3600 * 24)
        );
      }
    } else if (ecosystem === "cargo") {
      const [pkgResult, dlResult] = await Promise.all([
        fetchCratesIoPackage(pkg.name),
        fetchCratesIoDownloads(pkg.name),
      ]);

      if (!pkgResult.success) {
        return {
          result: buildDegradedResult(pkg, pkgResult.error === "not_found" ? "not_found" : "timeout"),
          rateLimit: null,
        };
      }

      npmUrl = `https://crates.io/crates/${pkg.name}`;
      githubUrl = extractGitHubUrl(pkgResult.data);

      // recent_downloads is last 90 days — estimate weekly
      registryData.weeklyDownloads = pkgResult.data.crate.recent_downloads
        ? Math.round(pkgResult.data.crate.recent_downloads / 13)
        : null;

      // Compute download trend from daily data
      if (dlResult.success) {
        const downloads = dlResult.data.version_downloads;
        const recentWeek = aggregateDownloads(downloads, 0, 7);
        const oldWeek = aggregateDownloads(downloads, 84, 91);
        if (recentWeek !== null) registryData.weeklyDownloads = recentWeek;
        if (oldWeek !== null) registryData.weeklyDownloads12wAgo = oldWeek;
      }

      // Multiple publishers
      const publishers = new Set<string>();
      for (const v of pkgResult.data.versions) {
        if (v.published_by?.login) publishers.add(v.published_by.login);
      }
      registryData.hasMultipleMaintainers = publishers.size > 1;

      // Days since last release (latest non-yanked version)
      const latestVersion = pkgResult.data.versions.find((v) => !v.yanked);
      if (latestVersion) {
        registryData.daysSinceLastRelease = Math.floor(
          (Date.now() - new Date(latestVersion.created_at).getTime()) / (1000 * 3600 * 24)
        );
      }
    } else if (ecosystem === "go") {
      // Parallel: Go proxy + deps.dev for dependent count
      const [modResult, depsDevResult] = await Promise.all([
        fetchGoModule(pkg.name),
        fetchDepsDevPackage("GO", pkg.name),
      ]);

      if (!modResult.success) {
        return {
          result: buildDegradedResult(pkg, modResult.error === "not_found" ? "not_found" : "timeout"),
          rateLimit: null,
        };
      }

      npmUrl = `https://pkg.go.dev/${pkg.name}`;
      githubUrl = extractGitHubUrlFromGoModule(pkg.name);

      // Go module proxy only gives latest version time
      if (modResult.data.Time) {
        registryData.daysSinceLastRelease = Math.floor(
          (Date.now() - new Date(modResult.data.Time).getTime()) / (1000 * 3600 * 24)
        );
      }

      // deps.dev: use version count as dependent popularity proxy
      if (depsDevResult.success && depsDevResult.data.versions) {
        const versionCount = depsDevResult.data.versions.length;
        // More versions = more established package
        if (versionCount >= 50) registryData.weeklyDownloads = 100000;
        else if (versionCount >= 20) registryData.weeklyDownloads = 50000;
        else if (versionCount >= 5) registryData.weeklyDownloads = 10000;
      }
    } else if (ecosystem === "rubygems") {
      const [gemResult, versionsResult] = await Promise.all([
        fetchRubyGem(pkg.name),
        fetchRubyGemVersions(pkg.name),
      ]);

      if (!gemResult.success) {
        return {
          result: buildDegradedResult(pkg, gemResult.error === "not_found" ? "not_found" : "timeout"),
          rateLimit: null,
        };
      }

      npmUrl = `https://rubygems.org/gems/${pkg.name}`;
      githubUrl = extractGitHubUrl(gemResult.data);

      // RubyGems provides total downloads and version downloads
      registryData.weeklyDownloads = gemResult.data.version_downloads
        ? Math.round(gemResult.data.version_downloads / 4)
        : null;

      // Days since last release from versions
      if (versionsResult.success && versionsResult.data.length > 0) {
        const latest = versionsResult.data[0];
        registryData.daysSinceLastRelease = Math.floor(
          (Date.now() - new Date(latest.created_at).getTime()) / (1000 * 3600 * 24)
        );

        // Estimate download trend from version history
        if (versionsResult.data.length >= 2) {
          registryData.weeklyDownloads = Math.round(
            versionsResult.data[0].downloads_count / 4
          );
        }
      }

      // No direct maintainer count from RubyGems basic API
      registryData.hasMultipleMaintainers = null;
    } else if (ecosystem === "packagist") {
      const pkgResult = await fetchPackagistPackage(pkg.name);

      if (!pkgResult.success) {
        return {
          result: buildDegradedResult(pkg, pkgResult.error === "not_found" ? "not_found" : "timeout"),
          rateLimit: null,
        };
      }

      npmUrl = `https://packagist.org/packages/${pkg.name}`;
      githubUrl = extractGitHubUrl(pkgResult.data);

      // Days since last release from versions
      const versions = Object.values(pkgResult.data.package.versions);
      if (versions.length > 0) {
        const latest = versions.reduce((newest, v) => {
          const t = new Date(v.time).getTime();
          return t > new Date(newest.time).getTime() ? v : newest;
        }, versions[0]);
        registryData.daysSinceLastRelease = Math.floor(
          (Date.now() - new Date(latest.time).getTime()) / (1000 * 3600 * 24)
        );
      }

      // Extract downloads from Packagist response
      if (pkgResult.data.package.downloads) {
        registryData.weeklyDownloads = Math.round(pkgResult.data.package.downloads.monthly / 4);
      }
    } else if (ecosystem === "maven") {
      const pkgResult = await fetchMavenPackage(pkg.name);

      if (!pkgResult.success) {
        return {
          result: buildDegradedResult(pkg, pkgResult.error === "not_found" ? "not_found" : "timeout"),
          rateLimit: null,
        };
      }

      const docs = (pkgResult.data as MavenSearchResult).response.docs;
      if (docs.length === 0) {
        return {
          result: buildDegradedResult(pkg, "not_found"),
          rateLimit: null,
        };
      }

      const [group, artifact] = pkg.name.split(":");
      npmUrl = `https://mvnrepository.com/artifact/${group}/${artifact}`;

      // Try to find GitHub URL from common patterns
      if (group.startsWith("com.github.") || group.startsWith("io.github.")) {
        const parts = group.split(".");
        githubUrl = `https://github.com/${parts[2]}/${artifact}`;
      }

      // Days since last release
      if (docs[0].timestamp) {
        registryData.daysSinceLastRelease = Math.floor(
          (Date.now() - docs[0].timestamp) / (1000 * 3600 * 24)
        );
      }
    } else if (ecosystem === "pub") {
      // Parallel: package data + score API
      const [pkgResult, scoreResult] = await Promise.all([
        fetchPubPackage(pkg.name),
        fetchPubPackageScore(pkg.name),
      ]);

      if (!pkgResult.success) {
        return {
          result: buildDegradedResult(pkg, pkgResult.error === "not_found" ? "not_found" : "timeout"),
          rateLimit: null,
        };
      }

      npmUrl = `https://pub.dev/packages/${pkg.name}`;
      githubUrl = extractGitHubUrl(pkgResult.data);

      // Days since last release
      if (pkgResult.data.latest.published) {
        registryData.daysSinceLastRelease = Math.floor(
          (Date.now() - new Date(pkgResult.data.latest.published).getTime()) / (1000 * 3600 * 24)
        );
      }

      // pub.dev score: popularityScore as download proxy
      if (scoreResult.success) {
        registryData.weeklyDownloads = Math.round(scoreResult.data.popularityScore * 1000000);
      }
    } else if (ecosystem === "vcpkg") {
      const [portResult, versionsResult, repologyResult] = await Promise.all([
        fetchVcpkgPort(pkg.name),
        fetchVcpkgVersions(pkg.name),
        fetchRepologyProject(pkg.name),
      ]);

      if (!portResult.success) {
        return {
          result: buildDegradedResult(pkg, portResult.error === "not_found" ? "not_found" : "timeout"),
          rateLimit: null,
        };
      }

      npmUrl = `https://vcpkg.io/en/package/${pkg.name}`;

      // Extract GitHub URL from homepage
      if (portResult.data.homepage) {
        const hp = portResult.data.homepage;
        if (isGitHubHostname(hp)) {
          githubUrl = hp;
        }
      }

      // Release cadence from version history
      if (versionsResult.success && versionsResult.data.versions.length > 0) {
        // Use version count as a proxy for release activity
        const versionCount = versionsResult.data.versions.length;
        // Estimate: if many versions, assume active development
        if (versionCount > 20) {
          registryData.daysSinceLastRelease = 30; // likely recent
        } else if (versionCount > 5) {
          registryData.daysSinceLastRelease = 180;
        }
      }

      // Repology: count how many distros/repos package this library
      if (repologyResult.success) {
        const distroCount = repologyResult.data.length;
        // Use distro count as popularity proxy for downloads
        // 50+ repos = very popular, 10+ = popular, <10 = niche
        if (distroCount >= 50) {
          registryData.weeklyDownloads = 1000000; // proxy: very popular
        } else if (distroCount >= 20) {
          registryData.weeklyDownloads = 100000;
        } else if (distroCount >= 5) {
          registryData.weeklyDownloads = 10000;
        } else {
          registryData.weeklyDownloads = 1000;
        }
      }
    }

    // Step 2: Fetch GitHub data (if URL available)
    let githubData: GitHubData = {
      metadata: null,
      lastCommit: null,
      contributors: null,
      recentPRs: null,
      advisories: null,
    };

    if (githubUrl) {
      const parsed = parseGitHubUrl(githubUrl);
      if (parsed) {
        const { owner, repo } = parsed;
        const [metaResult, commitResult, contribResult, prResult, advResult] =
          await Promise.all([
            fetchRepoMetadata(owner, repo, githubToken),
            fetchLastCommit(owner, repo, githubToken),
            fetchContributors(owner, repo, githubToken),
            fetchRecentPRs(owner, repo, githubToken),
            fetchSecurityAdvisories(owner, repo, githubToken),
          ]);

        // Track rate limit from any successful response
        for (const result of [metaResult, commitResult, contribResult, prResult, advResult]) {
          if (result.success) {
            latestRateLimit = result.rateLimit;
          } else if (result.error === "rate_limited") {
            return {
              result: buildDegradedResult(pkg, "github_rate_limit", result.retryAfter, npmUrl),
              rateLimit: latestRateLimit,
            };
          }
        }

        githubData = {
          metadata: metaResult.success ? metaResult.data : null,
          lastCommit: commitResult.success ? commitResult.data : null,
          contributors: contribResult.success ? contribResult.data : null,
          recentPRs: prResult.success ? prResult.data : null,
          advisories: advResult.success ? advResult.data : null,
        };
      }
    }

    // Step 3: Build signals and score
    const signals = buildSignals(githubData, registryData);
    const scored = scorePackage(signals);
    const isArchived = githubData.metadata?.archived ?? false;

    const result: HealthResult = {
      name: pkg.name,
      version: pkg.version,
      // Archived repos can't receive patches - cap at 70
      health_score: isArchived ? Math.min(scored.healthScore, 70) : scored.healthScore,
      risk_level: isArchived ? (scored.healthScore >= 60 ? "stable" : scored.riskLevel) : scored.riskLevel,
      data_confidence: githubUrl ? "high" : "low",
      signals: { ...buildSignalsResponse(signals, registryData), is_archived: isArchived },
      score_breakdown: {
        commit_score: scored.breakdown.commitScore,
        release_score: scored.breakdown.releaseScore,
        issue_health_score: scored.breakdown.issueHealthScore,
        contributor_score: scored.breakdown.contributorScore,
        pr_velocity_score: scored.breakdown.prVelocityScore,
        download_trend_score: scored.breakdown.downloadTrendScore,
        maintainer_score: scored.breakdown.maintainerScore,
        security_penalty: scored.breakdown.securityPenalty,
      },
      github_url: githubUrl,
      npm_url: npmUrl,
    };

    return { result, rateLimit: latestRateLimit };
  } catch {
    return {
      result: buildDegradedResult(pkg, "timeout"),
      rateLimit: latestRateLimit,
    };
  }
}

// ─── Batched Fetcher — Main Entry Point ─────────────────────────────────────

export async function fetchBatched(
  packages: Package[],
  ecosystem: Ecosystem,
  batchSize: number = 5,
  initialDelayMs: number = 200,
  githubToken?: string
): Promise<HealthResult[]> {
  const results: HealthResult[] = [];
  let currentRateLimit: RateLimitState = {
    remaining: 5000,
    used: 0,
    resetAt: "",
  };

  for (let i = 0; i < packages.length; i += batchSize) {
    // Check if we should stop
    const delay = getAdaptiveDelay(currentRateLimit.remaining, initialDelayMs);
    if (delay === -1) {
      // Rate limit critical — degrade remaining packages
      for (let j = i; j < packages.length; j++) {
        results.push(
          buildDegradedResult(
            packages[j],
            "github_rate_limit",
            currentRateLimit.resetAt
          )
        );
      }
      break;
    }

    // Process batch concurrently
    const batch = packages.slice(i, i + batchSize);

    const batchResults = await Promise.all(
      batch.map(async (pkg): Promise<FetchPackageResult> => {
        const cacheKey = buildCacheKey(ecosystem, pkg.name, pkg.version);

        // Check cache manually — never serve or write degraded results
        // Upstash automatically deserializes JSON, so cached is already a HealthResult object
        const cached = await redis.get(cacheKey);
        if (cached !== null && cached !== undefined) {
          const cachedResult = cached as HealthResult;
          // Skip stale degraded entries — delete and fetch fresh
          if (cachedResult.data_confidence === "unavailable") {
            await redis.del(cacheKey).catch(() => {});
          } else {
            return { result: cachedResult, rateLimit: null };
          }
        }

        // Fetch fresh data
        const fetchResult = await fetchPackageHealth(pkg, ecosystem, githubToken);

        // Only cache successful (non-degraded) results
        if (fetchResult.result.data_confidence !== "unavailable") {
          const ttl = getDynamicTTL(fetchResult.result.signals?.weekly_downloads ?? 0);
          await redis
            .set(cacheKey, JSON.stringify(fetchResult.result), { ex: ttl })
            .catch(() => {});
        }

        return fetchResult;
      })
    );

    for (const br of batchResults) {
      results.push(br.result);
      if (br.rateLimit) {
        currentRateLimit = br.rateLimit;
      }
    }

    // Adaptive delay between batches
    if (i + batchSize < packages.length && delay > 0) {
      await sleep(delay);
    }
  }

  return results;
}

export { buildDegradedResult };
