// ─── Auth / Session ─────────────────────────────────────────────────────────

export interface WatchlistEntry {
  id: string;
  name: string;
  ecosystem: Ecosystem;
  filename: string;
  packages: Package[];
  created_at: string;
  last_checked?: string;
  last_results?: HealthResult[];
}

// ─── Ecosystem ───────────────────────────────────────────────────────────────

export type Ecosystem = "npm" | "pypi" | "cargo" | "go" | "rubygems";

// ─── Package (from parser) ───────────────────────────────────────────────────

export interface Package {
  name: string;
  version: string;
}

// ─── Scoring Types ───────────────────────────────────────────────────────────

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

export interface ScoreBreakdown {
  commitScore: number;
  releaseScore: number;
  issueHealthScore: number;
  contributorScore: number;
  prVelocityScore: number;
  downloadTrendScore: number;
  maintainerScore: number;
  securityPenalty: number;
  weightedSum: number;
}

export interface ScoredPackage {
  healthScore: number;
  riskLevel: RiskLevel;
  breakdown: ScoreBreakdown;
}

// ─── Rate Limiting ───────────────────────────────────────────────────────────

export interface RateLimitState {
  remaining: number;
  used: number;
  resetAt: string;
}

// ─── Typed Result Union ──────────────────────────────────────────────────────

export type FetchResult<T> =
  | { success: true; data: T; cached: boolean; rateLimit: RateLimitState }
  | {
      success: false;
      error: "rate_limited" | "not_found" | "timeout" | "network_error";
      retryAfter?: string;
    };

// ─── Data Confidence ─────────────────────────────────────────────────────────

export type DataConfidence = "high" | "low" | "unavailable";

// ─── Signals (API response shape) ────────────────────────────────────────────

export interface SignalsResponse {
  days_since_last_commit: number | null;
  days_since_last_release: number | null;
  open_issues_ratio: number | null;
  contributor_count_90d: number | null;
  pr_merge_velocity_days: number | null;
  weekly_downloads: number | null;
  weekly_downloads_12w_ago: number | null;
  has_multiple_maintainers: boolean | null;
  unresolved_cves: number;
}

// ─── Score Breakdown (API response shape) ───────────────────────────────────

export interface ScoreBreakdownResponse {
  commit_score: number;
  release_score: number;
  issue_health_score: number;
  contributor_score: number;
  pr_velocity_score: number;
  download_trend_score: number;
  maintainer_score: number;
  security_penalty: number;
}

// ─── Per-Package Health Result ───────────────────────────────────────────────

export interface HealthResult {
  name: string;
  version: string;
  health_score: number | null;
  risk_level: RiskLevel;
  data_confidence: DataConfidence;
  reason?: "github_rate_limit" | "not_found" | "timeout";
  retry_after?: string;
  signals?: SignalsResponse;
  score_breakdown?: ScoreBreakdownResponse;
  github_url: string | null;
  npm_url: string | null;
}

// ─── API Contract ────────────────────────────────────────────────────────────

export interface AnalyzeRequest {
  ecosystem: Ecosystem;
  packages: Package[];
}

export interface AnalyzeMeta {
  analyzed_at: string;
  cache_hit_rate: number;
  degraded_count: number;
  github_rate_limit: RateLimitState;
}

export interface AnalyzeResponse {
  meta: AnalyzeMeta;
  results: HealthResult[];
}

// ─── GitHub API Response Types ───────────────────────────────────────────────

export interface GitHubRepoMetadata {
  full_name: string;
  open_issues_count: number;
  stargazers_count: number;
  has_issues: boolean;
  archived: boolean;
}

export interface GitHubCommit {
  sha: string;
  commit: {
    committer: {
      date: string;
    } | null;
  };
}

export interface GitHubContributorWeek {
  w: number;
  a: number;
  d: number;
  c: number;
}

export interface GitHubContributor {
  total: number;
  weeks: GitHubContributorWeek[];
  author: {
    login: string;
  } | null;
}

export interface GitHubPullRequest {
  number: number;
  state: string;
  merged_at: string | null;
  created_at: string;
}

export interface GitHubSecurityAdvisory {
  ghsa_id: string;
  severity: string;
  state: string;
  vulnerabilities?: Array<{
    package?: {
      ecosystem: string;
      name: string;
    };
    vulnerable_version_range?: string;
    patched_versions?: string | null;
  }>;
}

// ─── npm API Response Types ──────────────────────────────────────────────────

export interface NpmPackageData {
  name: string;
  repository?: {
    type?: string;
    url?: string;
  };
  maintainers?: Array<{ name: string }>;
  "dist-tags"?: {
    latest?: string;
  };
  time?: Record<string, string>;
}

export interface NpmDownloadsData {
  downloads: number;
  package: string;
  start: string;
  end: string;
}

// ─── PyPI API Response Types ─────────────────────────────────────────────────

export interface PyPIPackageData {
  info: {
    name: string;
    version: string;
    project_urls: Record<string, string> | null;
    maintainer: string | null;
    author: string | null;
  };
  releases: Record<string, Array<{ upload_time: string }>>;
}

export interface PyPIDownloadsData {
  data: {
    last_week: number;
  };
  package: string;
  type: string;
}

// ─── Cargo (crates.io) API Response Types ───────────────────────────────────

export interface CratesIoPackageData {
  crate: {
    name: string;
    repository: string | null;
    max_version: string;
    recent_downloads: number | null;
    created_at: string;
    updated_at: string;
  };
  versions: Array<{
    num: string;
    created_at: string;
    yanked: boolean;
    published_by: { login: string } | null;
  }>;
}

export interface CratesIoDownloadsData {
  version_downloads: Array<{
    date: string;
    downloads: number;
  }>;
}

// ─── Go Module Proxy API Response Types ─────────────────────────────────────

export interface GoModuleData {
  Version: string;
  Time: string;
}

// ─── RubyGems API Response Types ────────────────────────────────────────────

export interface RubyGemData {
  name: string;
  downloads: number;
  version: string;
  version_downloads: number;
  source_code_uri: string | null;
  homepage_uri: string | null;
  project_uri: string;
  metadata: Record<string, string>;
}

export interface RubyGemVersionData {
  number: string;
  created_at: string;
  downloads_count: number;
}
