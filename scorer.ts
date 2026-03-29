/**
 * scorer.ts — Health Score Engine
 *
 * RULES (enforced by CLAUDE.md):
 *  - Pure functions only. Zero API calls. Zero side effects. Zero imports from lib/.
 *  - Every function: (value: number | null) => number
 *  - Every output: clamped to [0, 100]
 *  - null input = insufficient data → use defined fallback score
 *  - security_penalty is a multiplier applied AFTER the weighted sum
 *  - Formula weights are defined in SYSTEM_DESIGN.md. Do not change them here.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PackageSignals {
  daysSinceLastCommit: number | null;
  daysSinceLastRelease: number | null;
  openIssues: number | null;
  closedIssues: number | null;
  contributorCount90d: number | null;
  prMergeVelocityDays: number | null;
  weeklyDownloads: number | null;
  weeklyDownloads12wAgo: number | null;
  hasMultipleMaintainers: boolean | null;
  unresolvedCves: number;
}

export type RiskLevel =
  | "healthy"
  | "stable"
  | "at_risk"
  | "critical"
  | "abandoned"
  | "unknown";

export interface ScoredPackage {
  healthScore: number;
  riskLevel: RiskLevel;
  breakdown: {
    commitScore: number;
    releaseScore: number;
    issueHealthScore: number;
    contributorScore: number;
    prVelocityScore: number;
    downloadTrendScore: number;
    maintainerScore: number;
    securityPenalty: number;
    weightedSum: number;
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

// ─── Individual Signal Scorers ────────────────────────────────────────────────

/**
 * Weight: 0.25
 * Measures: Is anyone actively committing to this repo?
 */
export function scoreCommits(daysSinceLastCommit: number | null): number {
  if (daysSinceLastCommit === null) return 40; // insufficient data

  if (daysSinceLastCommit <= 30) return 100;
  if (daysSinceLastCommit <= 90) return 80;
  if (daysSinceLastCommit <= 180) return 55;
  if (daysSinceLastCommit <= 365) return 25;
  return 0;
}

/**
 * Weight: 0.20
 * Measures: Are fixes and features actually reaching published versions?
 */
export function scoreRelease(daysSinceLastRelease: number | null): number {
  if (daysSinceLastRelease === null) return 40; // insufficient data

  if (daysSinceLastRelease <= 60) return 100;
  if (daysSinceLastRelease <= 180) return 75;
  if (daysSinceLastRelease <= 365) return 40;
  if (daysSinceLastRelease <= 730) return 10;
  return 0;
}

/**
 * Weight: 0.15
 * Measures: Is the maintainer responsive to reported problems?
 * open_ratio = open / (open + closed). Higher ratio = worse health.
 */
export function scoreIssueHealth(
  openIssues: number | null,
  closedIssues: number | null
): number {
  if (openIssues === null || closedIssues === null) return 70; // insufficient data

  const total = openIssues + closedIssues;
  if (total < 10) return 70; // insufficient data — too few issues to be meaningful

  const openRatio = openIssues / total;
  return clamp((1 - openRatio) * 100);
}

/**
 * Weight: 0.15
 * Measures: Bus factor — is this a single-maintainer time bomb?
 */
export function scoreContributors(contributorCount90d: number | null): number {
  if (contributorCount90d === null) return 40; // insufficient data

  if (contributorCount90d === 0) return 0;
  if (contributorCount90d === 1) return 30; // single maintainer = critical risk
  if (contributorCount90d <= 4) return 65;
  if (contributorCount90d <= 10) return 85;
  return 100;
}

/**
 * Weight: 0.10
 * Measures: Is contribution welcome? Slow PR merges signal an unmaintained repo.
 */
export function scorePrVelocity(prMergeVelocityDays: number | null): number {
  if (prMergeVelocityDays === null) return 40; // no merged PRs or insufficient data

  if (prMergeVelocityDays <= 3) return 100;
  if (prMergeVelocityDays <= 14) return 80;
  if (prMergeVelocityDays <= 30) return 55;
  if (prMergeVelocityDays <= 90) return 25;
  return 0;
}

/**
 * Weight: 0.10
 * Measures: Is the broader ecosystem quietly migrating away from this package?
 * Compares current week downloads vs 12 weeks ago.
 */
export function scoreDownloadTrend(
  weeklyDownloads: number | null,
  weeklyDownloads12wAgo: number | null
): number {
  if (weeklyDownloads === null || weeklyDownloads12wAgo === null) return 50;
  if (weeklyDownloads12wAgo === 0) return 50; // can't compute meaningful ratio

  const changeRatio =
    (weeklyDownloads - weeklyDownloads12wAgo) / weeklyDownloads12wAgo;

  if (changeRatio > 0.1) return 100;   // growing > 10%
  if (changeRatio >= -0.1) return 75;  // stable ±10%
  if (changeRatio >= -0.3) return 40;  // declining 10–30%
  return 15;                           // declining > 30%
}

/**
 * Weight: 0.05
 * Measures: Is a single person the only thing keeping this alive?
 */
export function scoreMaintainers(hasMultipleMaintainers: boolean | null): number {
  if (hasMultipleMaintainers === null) return 50; // insufficient data
  return hasMultipleMaintainers ? 100 : 30;
}

/**
 * Final multiplier — applied after the weighted sum.
 * Unresolved CVEs are a hard signal that the package is unsafe regardless of activity.
 */
export function calculateSecurityPenalty(unresolvedCves: number): number {
  if (unresolvedCves === 0) return 1.0;
  if (unresolvedCves === 1) return 0.85;
  if (unresolvedCves <= 3) return 0.65;
  return 0.40;
}

// ─── Risk Classification ──────────────────────────────────────────────────────

export function classifyRisk(healthScore: number): RiskLevel {
  if (healthScore >= 80) return "healthy";
  if (healthScore >= 60) return "stable";
  if (healthScore >= 40) return "at_risk";
  if (healthScore >= 20) return "critical";
  return "abandoned";
}

// ─── Main Entry Point ─────────────────────────────────────────────────────────

/**
 * scorePackage — the single public function for scoring a package.
 *
 * Takes raw signals from the API layer and returns a fully scored package.
 * This function is the boundary between "data fetching" and "business logic".
 * It must remain pure and side-effect free.
 */
export function scorePackage(signals: PackageSignals): ScoredPackage {
  const commitScore = scoreCommits(signals.daysSinceLastCommit);
  const releaseScore = scoreRelease(signals.daysSinceLastRelease);
  const issueHealthScore = scoreIssueHealth(signals.openIssues, signals.closedIssues);
  const contributorScore = scoreContributors(signals.contributorCount90d);
  const prVelocityScore = scorePrVelocity(signals.prMergeVelocityDays);
  const downloadTrendScore = scoreDownloadTrend(
    signals.weeklyDownloads,
    signals.weeklyDownloads12wAgo
  );
  const maintainerScore = scoreMaintainers(signals.hasMultipleMaintainers);
  const securityPenalty = calculateSecurityPenalty(signals.unresolvedCves);

  const weightedSum =
    commitScore       * 0.25 +
    releaseScore      * 0.20 +
    issueHealthScore  * 0.15 +
    contributorScore  * 0.15 +
    prVelocityScore   * 0.10 +
    downloadTrendScore * 0.10 +
    maintainerScore   * 0.05;

  const healthScore = clamp(weightedSum * securityPenalty);
  const riskLevel = classifyRisk(healthScore);

  return {
    healthScore,
    riskLevel,
    breakdown: {
      commitScore,
      releaseScore,
      issueHealthScore,
      contributorScore,
      prVelocityScore,
      downloadTrendScore,
      maintainerScore,
      securityPenalty,
      weightedSum: clamp(weightedSum),
    },
  };
}
