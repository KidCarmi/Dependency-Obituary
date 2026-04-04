import { describe, it, expect } from "vitest";
import {
  scoreCommits,
  scoreRelease,
  scoreIssueHealth,
  scoreContributors,
  scorePrVelocity,
  scoreDownloadTrend,
  scoreMaintainers,
  calculateSecurityPenalty,
  classifyRisk,
  scorePackage,
  isMaturePackage,
} from "@/lib/scorer";
import type { PackageSignals } from "@/types";

// ─── scoreCommits ───────────────────────────────────────────────────────────

describe("scoreCommits", () => {
  it("returns 40 for null (insufficient data)", () => {
    expect(scoreCommits(null)).toBe(40);
  });

  it("returns 100 for 0 days", () => {
    expect(scoreCommits(0)).toBe(100);
  });

  it("returns 100 for 30 days", () => {
    expect(scoreCommits(30)).toBe(100);
  });

  it("returns 80 for 31 days", () => {
    expect(scoreCommits(31)).toBe(80);
  });

  it("returns 80 for 90 days", () => {
    expect(scoreCommits(90)).toBe(80);
  });

  it("returns 55 for 91 days", () => {
    expect(scoreCommits(91)).toBe(55);
  });

  it("returns 55 for 180 days", () => {
    expect(scoreCommits(180)).toBe(55);
  });

  it("returns 25 for 181 days", () => {
    expect(scoreCommits(181)).toBe(25);
  });

  it("returns 25 for 365 days", () => {
    expect(scoreCommits(365)).toBe(25);
  });

  it("returns 0 for 366 days", () => {
    expect(scoreCommits(366)).toBe(0);
  });

  it("returns 0 for very large values", () => {
    expect(scoreCommits(10000)).toBe(0);
  });
});

// ─── scoreRelease ───────────────────────────────────────────────────────────

describe("scoreRelease", () => {
  it("returns 40 for null", () => {
    expect(scoreRelease(null)).toBe(40);
  });

  it("returns 100 for 0 days", () => {
    expect(scoreRelease(0)).toBe(100);
  });

  it("returns 100 for 60 days", () => {
    expect(scoreRelease(60)).toBe(100);
  });

  it("returns 75 for 61 days", () => {
    expect(scoreRelease(61)).toBe(75);
  });

  it("returns 75 for 180 days", () => {
    expect(scoreRelease(180)).toBe(75);
  });

  it("returns 40 for 181 days", () => {
    expect(scoreRelease(181)).toBe(40);
  });

  it("returns 40 for 365 days", () => {
    expect(scoreRelease(365)).toBe(40);
  });

  it("returns 10 for 366 days", () => {
    expect(scoreRelease(366)).toBe(10);
  });

  it("returns 10 for 730 days", () => {
    expect(scoreRelease(730)).toBe(10);
  });

  it("returns 0 for 731 days", () => {
    expect(scoreRelease(731)).toBe(0);
  });
});

// ─── scoreIssueHealth ───────────────────────────────────────────────────────

describe("scoreIssueHealth", () => {
  it("returns 70 when openIssues is null", () => {
    expect(scoreIssueHealth(null, 100)).toBe(70);
  });

  it("returns 70 when closedIssues is null", () => {
    expect(scoreIssueHealth(100, null)).toBe(70);
  });

  it("returns 70 when both are null", () => {
    expect(scoreIssueHealth(null, null)).toBe(70);
  });

  it("returns 70 when total issues < 10", () => {
    expect(scoreIssueHealth(3, 5)).toBe(70);
  });

  it("returns 90 for 10% open ratio (1 open, 9 closed)", () => {
    expect(scoreIssueHealth(1, 9)).toBe(90);
  });

  it("returns 50 for 50% open ratio", () => {
    expect(scoreIssueHealth(50, 50)).toBe(50);
  });

  it("returns 0 for 100% open ratio", () => {
    expect(scoreIssueHealth(100, 0)).toBe(0);
  });

  it("returns 100 for 0% open ratio", () => {
    expect(scoreIssueHealth(0, 100)).toBe(100);
  });
});

// ─── scoreContributors ──────────────────────────────────────────────────────

describe("scoreContributors", () => {
  it("returns 40 for null", () => {
    expect(scoreContributors(null)).toBe(40);
  });

  it("returns 0 for 0 contributors", () => {
    expect(scoreContributors(0)).toBe(0);
  });

  it("returns 30 for 1 contributor", () => {
    expect(scoreContributors(1)).toBe(30);
  });

  it("returns 65 for 2 contributors", () => {
    expect(scoreContributors(2)).toBe(65);
  });

  it("returns 65 for 4 contributors", () => {
    expect(scoreContributors(4)).toBe(65);
  });

  it("returns 85 for 5 contributors", () => {
    expect(scoreContributors(5)).toBe(85);
  });

  it("returns 85 for 10 contributors", () => {
    expect(scoreContributors(10)).toBe(85);
  });

  it("returns 100 for 11 contributors", () => {
    expect(scoreContributors(11)).toBe(100);
  });
});

// ─── scorePrVelocity ────────────────────────────────────────────────────────

describe("scorePrVelocity", () => {
  it("returns 40 for null", () => {
    expect(scorePrVelocity(null)).toBe(40);
  });

  it("returns 100 for 0 days", () => {
    expect(scorePrVelocity(0)).toBe(100);
  });

  it("returns 100 for 3 days", () => {
    expect(scorePrVelocity(3)).toBe(100);
  });

  it("returns 80 for 4 days", () => {
    expect(scorePrVelocity(4)).toBe(80);
  });

  it("returns 80 for 14 days", () => {
    expect(scorePrVelocity(14)).toBe(80);
  });

  it("returns 55 for 15 days", () => {
    expect(scorePrVelocity(15)).toBe(55);
  });

  it("returns 55 for 30 days", () => {
    expect(scorePrVelocity(30)).toBe(55);
  });

  it("returns 25 for 31 days", () => {
    expect(scorePrVelocity(31)).toBe(25);
  });

  it("returns 25 for 90 days", () => {
    expect(scorePrVelocity(90)).toBe(25);
  });

  it("returns 0 for 91 days", () => {
    expect(scorePrVelocity(91)).toBe(0);
  });
});

// ─── scoreDownloadTrend ─────────────────────────────────────────────────────

describe("scoreDownloadTrend", () => {
  it("returns 50 when current is null", () => {
    expect(scoreDownloadTrend(null, 1000)).toBe(50);
  });

  it("returns 50 when 12w ago is null", () => {
    expect(scoreDownloadTrend(1000, null)).toBe(50);
  });

  it("returns 50 when 12w ago is 0", () => {
    expect(scoreDownloadTrend(1000, 0)).toBe(50);
  });

  it("returns 100 for >10% growth", () => {
    expect(scoreDownloadTrend(1200, 1000)).toBe(100);
  });

  it("returns 75 for stable (0% change)", () => {
    expect(scoreDownloadTrend(1000, 1000)).toBe(75);
  });

  it("returns 75 for -10% (boundary)", () => {
    expect(scoreDownloadTrend(900, 1000)).toBe(75);
  });

  it("returns 40 for -20% decline", () => {
    expect(scoreDownloadTrend(800, 1000)).toBe(40);
  });

  it("returns 40 for -30% decline (boundary)", () => {
    expect(scoreDownloadTrend(700, 1000)).toBe(40);
  });

  it("returns 15 for >30% decline", () => {
    expect(scoreDownloadTrend(600, 1000)).toBe(15);
  });
});

// ─── scoreMaintainers ───────────────────────────────────────────────────────

describe("scoreMaintainers", () => {
  it("returns 50 for null", () => {
    expect(scoreMaintainers(null)).toBe(50);
  });

  it("returns 100 for multiple maintainers", () => {
    expect(scoreMaintainers(true)).toBe(100);
  });

  it("returns 30 for single maintainer", () => {
    expect(scoreMaintainers(false)).toBe(30);
  });
});

// ─── calculateSecurityPenalty ───────────────────────────────────────────────

describe("calculateSecurityPenalty", () => {
  it("returns 1.0 for 0 CVEs", () => {
    expect(calculateSecurityPenalty(0)).toBe(1.0);
  });

  it("returns 0.85 for 1 CVE", () => {
    expect(calculateSecurityPenalty(1)).toBe(0.85);
  });

  it("returns 0.65 for 2 CVEs", () => {
    expect(calculateSecurityPenalty(2)).toBe(0.65);
  });

  it("returns 0.65 for 3 CVEs", () => {
    expect(calculateSecurityPenalty(3)).toBe(0.65);
  });

  it("returns 0.40 for 4 CVEs", () => {
    expect(calculateSecurityPenalty(4)).toBe(0.40);
  });

  it("returns 0.40 for 10 CVEs", () => {
    expect(calculateSecurityPenalty(10)).toBe(0.40);
  });
});

// ─── classifyRisk ───────────────────────────────────────────────────────────

describe("classifyRisk", () => {
  it("returns healthy for 100", () => {
    expect(classifyRisk(100)).toBe("healthy");
  });

  it("returns healthy for 80", () => {
    expect(classifyRisk(80)).toBe("healthy");
  });

  it("returns stable for 79", () => {
    expect(classifyRisk(79)).toBe("stable");
  });

  it("returns stable for 60", () => {
    expect(classifyRisk(60)).toBe("stable");
  });

  it("returns at_risk for 59", () => {
    expect(classifyRisk(59)).toBe("at_risk");
  });

  it("returns at_risk for 40", () => {
    expect(classifyRisk(40)).toBe("at_risk");
  });

  it("returns critical for 39", () => {
    expect(classifyRisk(39)).toBe("critical");
  });

  it("returns critical for 20", () => {
    expect(classifyRisk(20)).toBe("critical");
  });

  it("returns abandoned for 19", () => {
    expect(classifyRisk(19)).toBe("abandoned");
  });

  it("returns abandoned for 0", () => {
    expect(classifyRisk(0)).toBe("abandoned");
  });
});

// ─── scorePackage (integration) ─────────────────────────────────────────────

describe("scorePackage", () => {
  const healthySignals: PackageSignals = {
    daysSinceLastCommit: 10,
    daysSinceLastRelease: 30,
    openIssues: 10,
    closedIssues: 90,
    contributorCount90d: 8,
    prMergeVelocityDays: 2,
    weeklyDownloads: 2000000,
    weeklyDownloads12wAgo: 1500000,
    hasMultipleMaintainers: true,
    unresolvedCves: 0,
  };

  it("scores a healthy package correctly", () => {
    const result = scorePackage(healthySignals);
    expect(result.healthScore).toBeGreaterThanOrEqual(80);
    expect(result.riskLevel).toBe("healthy");
  });

  const abandonedSignals: PackageSignals = {
    daysSinceLastCommit: 1000,
    daysSinceLastRelease: 1000,
    openIssues: 90,
    closedIssues: 10,
    contributorCount90d: 0,
    prMergeVelocityDays: 200,
    weeklyDownloads: 100,
    weeklyDownloads12wAgo: 5000,
    hasMultipleMaintainers: false,
    unresolvedCves: 5,
  };

  it("scores an abandoned package correctly", () => {
    const result = scorePackage(abandonedSignals);
    expect(result.healthScore).toBeLessThanOrEqual(19);
    expect(result.riskLevel).toBe("abandoned");
  });

  it("returns all breakdown fields", () => {
    const result = scorePackage(healthySignals);
    expect(result.breakdown).toHaveProperty("commitScore");
    expect(result.breakdown).toHaveProperty("releaseScore");
    expect(result.breakdown).toHaveProperty("issueHealthScore");
    expect(result.breakdown).toHaveProperty("contributorScore");
    expect(result.breakdown).toHaveProperty("prVelocityScore");
    expect(result.breakdown).toHaveProperty("downloadTrendScore");
    expect(result.breakdown).toHaveProperty("maintainerScore");
    expect(result.breakdown).toHaveProperty("securityPenalty");
    expect(result.breakdown).toHaveProperty("weightedSum");
  });

  it("applies security penalty correctly", () => {
    const withCves = { ...healthySignals, unresolvedCves: 2 };
    const withoutCves = { ...healthySignals, unresolvedCves: 0 };

    const scoredWith = scorePackage(withCves);
    const scoredWithout = scorePackage(withoutCves);

    expect(scoredWith.healthScore).toBeLessThan(scoredWithout.healthScore);
    expect(scoredWith.breakdown.securityPenalty).toBe(0.65);
    expect(scoredWithout.breakdown.securityPenalty).toBe(1.0);
  });

  it("handles all null signals gracefully", () => {
    const allNull: PackageSignals = {
      daysSinceLastCommit: null,
      daysSinceLastRelease: null,
      openIssues: null,
      closedIssues: null,
      contributorCount90d: null,
      prMergeVelocityDays: null,
      weeklyDownloads: null,
      weeklyDownloads12wAgo: null,
      hasMultipleMaintainers: null,
      unresolvedCves: 0,
    };

    const result = scorePackage(allNull);
    expect(result.healthScore).toBeGreaterThanOrEqual(0);
    expect(result.healthScore).toBeLessThanOrEqual(100);
    expect(typeof result.riskLevel).toBe("string");
  });

  it("clamps score to [0, 100]", () => {
    const result = scorePackage(healthySignals);
    expect(result.healthScore).toBeGreaterThanOrEqual(0);
    expect(result.healthScore).toBeLessThanOrEqual(100);
    expect(result.breakdown.weightedSum).toBeGreaterThanOrEqual(0);
    expect(result.breakdown.weightedSum).toBeLessThanOrEqual(100);
  });
});

// ─── Mature Package Detection ───────────────────────────────────────────────

describe("isMaturePackage", () => {
  it("detects google/uuid as mature (high downloads, 0 CVEs, few issues)", () => {
    const signals: PackageSignals = {
      daysSinceLastCommit: 505,
      daysSinceLastRelease: 801,
      openIssues: 5,
      closedIssues: null,
      contributorCount90d: null,
      prMergeVelocityDays: 5.8,
      weeklyDownloads: 100000,
      weeklyDownloads12wAgo: null,
      hasMultipleMaintainers: null,
      unresolvedCves: 0,
    };
    expect(isMaturePackage(signals)).toBe(true);
    const scored = scorePackage(signals);
    expect(scored.breakdown.commitScore).toBe(75); // boosted from 0
    expect(scored.breakdown.releaseScore).toBe(75); // boosted from 0
    expect(scored.healthScore).toBeGreaterThanOrEqual(70);
  });
});
