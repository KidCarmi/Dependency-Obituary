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

import type { PackageSignals, RiskLevel, ScoredPackage, ScoreBreakdown } from "@/types";

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

// ─── Mature Package Detection ────────────────────────────────────────────────

/**
 * Detects "complete" packages - still widely used but intentionally inactive.
 * Examples: left-pad, inherits, escape-html, is-odd
 *
 * A package is likely mature/complete when:
 * - High downloads (still widely used by the ecosystem)
 * - Stable or growing download trend (not being abandoned by users)
 * - Few or no open issues (no unresolved problems)
 * - No unresolved CVEs (no security concerns)
 *
 * Returns true if the package appears complete rather than abandoned.
 */
export function isMaturePackage(signals: PackageSignals): boolean {
  // Must have download data to assess
  if (signals.weeklyDownloads === null) return false;

  // Must have significant adoption (>10k weekly downloads)
  if (signals.weeklyDownloads < 10000) return false;

  // Must not have unresolved CVEs
  if (signals.unresolvedCves > 0) return false;

  // Download trend must be stable or growing (not declining)
  if (
    signals.weeklyDownloads12wAgo !== null &&
    signals.weeklyDownloads12wAgo > 0
  ) {
    const changeRatio =
      (signals.weeklyDownloads - signals.weeklyDownloads12wAgo) /
      signals.weeklyDownloads12wAgo;
    // If downloads are declining more than 20%, it's probably being abandoned
    if (changeRatio < -0.2) return false;
  }

  // Must have very few open issues (or no issue data)
  if (signals.openIssues !== null && signals.openIssues > 15) return false;

  return true;
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
  const securityPenalty = calculateSecurityPenalty(signals.unresolvedCves);
  const mature = isMaturePackage(signals);

  // If package is mature/complete, boost commit and release scores.
  // Inactivity in a widely-used, issue-free package is intentional, not abandonment.
  const commitScore = mature
    ? Math.max(scoreCommits(signals.daysSinceLastCommit), 75)
    : scoreCommits(signals.daysSinceLastCommit);
  const releaseScore = mature
    ? Math.max(scoreRelease(signals.daysSinceLastRelease), 75)
    : scoreRelease(signals.daysSinceLastRelease);

  // Each signal: { score, weight, hasData }
  // When hasData is false, its weight is redistributed to signals with real data.
  // This prevents null GitHub signals from dragging scores down unfairly.
  const signalEntries: Array<{
    key: keyof ScoreBreakdown;
    score: number;
    weight: number;
    hasData: boolean;
  }> = [
    {
      key: "commitScore",
      score: commitScore,
      weight: 0.25,
      hasData: signals.daysSinceLastCommit !== null,
    },
    {
      key: "releaseScore",
      score: releaseScore,
      weight: 0.20,
      hasData: signals.daysSinceLastRelease !== null,
    },
    {
      key: "issueHealthScore",
      score: scoreIssueHealth(signals.openIssues, signals.closedIssues),
      weight: 0.15,
      hasData: signals.openIssues !== null && signals.closedIssues !== null,
    },
    {
      key: "contributorScore",
      score: scoreContributors(signals.contributorCount90d),
      weight: 0.15,
      hasData: signals.contributorCount90d !== null,
    },
    {
      key: "prVelocityScore",
      score: scorePrVelocity(signals.prMergeVelocityDays),
      weight: 0.10,
      hasData: signals.prMergeVelocityDays !== null,
    },
    {
      key: "downloadTrendScore",
      score: scoreDownloadTrend(signals.weeklyDownloads, signals.weeklyDownloads12wAgo),
      weight: 0.10,
      hasData: signals.weeklyDownloads !== null && signals.weeklyDownloads12wAgo !== null,
    },
    {
      key: "maintainerScore",
      score: scoreMaintainers(signals.hasMultipleMaintainers),
      weight: 0.05,
      hasData: signals.hasMultipleMaintainers !== null,
    },
  ];

  // Redistribute null signal weights to signals with real data
  const totalDataWeight = signalEntries
    .filter((s) => s.hasData)
    .reduce((sum, s) => sum + s.weight, 0);

  let weightedSum = 0;
  for (const entry of signalEntries) {
    if (entry.hasData && totalDataWeight > 0) {
      // Scale weight proportionally so available signals sum to 1.0
      weightedSum += entry.score * (entry.weight / totalDataWeight);
    } else if (!entry.hasData && totalDataWeight === 0) {
      // All signals null — use fallbacks with original weights
      weightedSum += entry.score * entry.weight;
    }
  }

  const healthScore = clamp(weightedSum * securityPenalty);
  const riskLevel = classifyRisk(healthScore);

  // Build breakdown using individual scores (including fallbacks for display)
  const breakdown: ScoreBreakdown = {
    commitScore: signalEntries[0].score,
    releaseScore: signalEntries[1].score,
    issueHealthScore: signalEntries[2].score,
    contributorScore: signalEntries[3].score,
    prVelocityScore: signalEntries[4].score,
    downloadTrendScore: signalEntries[5].score,
    maintainerScore: signalEntries[6].score,
    securityPenalty,
    weightedSum: clamp(weightedSum),
  };

  return { healthScore, riskLevel, breakdown };
}
