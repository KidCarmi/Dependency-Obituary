"use client";

import { useState, useMemo, useCallback } from "react";
import type {
  AnalyzeResponse,
  HealthResult,
  RiskLevel,
} from "@/types";

const RISK_COLORS: Record<RiskLevel, string> = {
  healthy: "text-green-400",
  stable: "text-blue-400",
  at_risk: "text-yellow-400",
  critical: "text-orange-400",
  abandoned: "text-red-400",
  unknown: "text-gray-500",
};

const RISK_BG: Record<RiskLevel, string> = {
  healthy: "bg-green-400/10",
  stable: "bg-blue-400/10",
  at_risk: "bg-yellow-400/10",
  critical: "bg-orange-400/10",
  abandoned: "bg-red-400/10",
  unknown: "bg-gray-400/10",
};

const RISK_LABELS: Record<RiskLevel, string> = {
  healthy: "Healthy",
  stable: "Stable",
  at_risk: "At Risk",
  critical: "Critical",
  abandoned: "Unmaintained",
  unknown: "Unknown",
};

type SortKey = "name" | "health_score" | "risk_level";
type SortDir = "asc" | "desc";

interface Props {
  data: AnalyzeResponse;
}

export default function ResultsDashboard({ data }: Props): React.ReactElement {
  const [sortKey, setSortKey] = useState<SortKey>("health_score");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [riskFilter, setRiskFilter] = useState<Set<RiskLevel>>(new Set());

  const riskCounts = useMemo(() => {
    const counts: Record<RiskLevel, number> = {
      healthy: 0, stable: 0, at_risk: 0, critical: 0, abandoned: 0, unknown: 0,
    };
    for (const r of data.results) {
      counts[r.risk_level]++;
    }
    return counts;
  }, [data.results]);

  const filtered = useMemo(() => {
    return data.results.filter((r) => {
      if (searchQuery && !r.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (riskFilter.size > 0 && !riskFilter.has(r.risk_level)) return false;
      return true;
    });
  }, [data.results, searchQuery, riskFilter]);

  const sorted = useMemo(() => {
    const riskOrder: Record<RiskLevel, number> = {
      abandoned: 0, critical: 1, at_risk: 2, stable: 3, healthy: 4, unknown: 5,
    };
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") cmp = a.name.localeCompare(b.name);
      else if (sortKey === "health_score") cmp = (a.health_score ?? -1) - (b.health_score ?? -1);
      else cmp = riskOrder[a.risk_level] - riskOrder[b.risk_level];
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const handleSort = (key: SortKey): void => {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const sortArrow = (key: SortKey): string => {
    if (sortKey !== key) return "";
    return sortDir === "asc" ? " \u2191" : " \u2193";
  };

  const toggleRiskFilter = (level: RiskLevel): void => {
    setRiskFilter((prev) => {
      const next = new Set(prev);
      if (next.has(level)) next.delete(level);
      else next.add(level);
      return next;
    });
  };

  // ─── Export ──────────────────────────────────────────────────────────────

  const handleExportJSON = useCallback(() => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "dependency-obituary-report.json";
    a.click();
    URL.revokeObjectURL(url);
  }, [data]);

  const handleExportCSV = useCallback(() => {
    const headers = ["Package", "Version", "Score", "Risk Level", "Confidence", "GitHub URL", "Registry URL"];
    const rows = data.results.map((r) => [
      r.name,
      r.version,
      r.health_score !== null ? String(r.health_score) : "",
      r.risk_level,
      r.data_confidence,
      r.github_url ?? "",
      r.npm_url ?? "",
    ]);
    const csv = [headers, ...rows].map((row) => row.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "dependency-obituary-report.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, [data]);

  return (
    <div>
      {/* Header + Export */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold mb-1">Health Report</h1>
          <p className="text-sm text-gray-500">
            Analyzed {data.results.length} packages &middot;{" "}
            {Math.round(data.meta.cache_hit_rate * 100)}% cache hits
            {data.meta.degraded_count > 0 && (
              <span className="text-yellow-500">
                {" "}&middot; {data.meta.degraded_count} unavailable
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExportJSON}
            className="px-3 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors"
          >
            Export JSON
          </button>
          <button
            onClick={handleExportCSV}
            className="px-3 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Summary Cards -clickable as filters */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mb-6">
        {(["healthy", "stable", "at_risk", "critical", "abandoned"] as const).map((level) => (
          <button
            key={level}
            onClick={() => toggleRiskFilter(level)}
            className={`rounded-lg p-4 text-left transition-all ${RISK_BG[level]} ${
              riskFilter.size > 0 && !riskFilter.has(level) ? "opacity-30" : ""
            }`}
          >
            <div className={`text-2xl font-bold ${RISK_COLORS[level]}`}>
              {riskCounts[level]}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              {RISK_LABELS[level]}
            </div>
          </button>
        ))}
      </div>

      {/* Search + Filter Bar */}
      <div className="flex items-center gap-3 mb-4">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search packages..."
          className="flex-1 px-3 py-2 text-sm bg-gray-900 border border-gray-800 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-gray-600"
        />
        {(searchQuery || riskFilter.size > 0) && (
          <button
            onClick={() => { setSearchQuery(""); setRiskFilter(new Set()); }}
            className="text-xs text-gray-500 hover:text-white transition-colors"
          >
            Clear filters
          </button>
        )}
        <span className="text-xs text-gray-600">
          {filtered.length} of {data.results.length}
        </span>
      </div>

      {/* Results Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 bg-gray-900/50">
              <th
                className="text-left p-3 cursor-pointer hover:text-white text-gray-400 font-medium"
                onClick={() => handleSort("name")}
              >
                Package{sortArrow("name")}
              </th>
              <th className="text-left p-3 text-gray-400 font-medium">Version</th>
              <th
                className="text-left p-3 cursor-pointer hover:text-white text-gray-400 font-medium"
                onClick={() => handleSort("health_score")}
              >
                Score{sortArrow("health_score")}
              </th>
              <th
                className="text-left p-3 cursor-pointer hover:text-white text-gray-400 font-medium"
                onClick={() => handleSort("risk_level")}
              >
                Status{sortArrow("risk_level")}
              </th>
              <th className="text-left p-3 text-gray-400 font-medium">Links</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((result) => (
              <ResultRow
                key={`${result.name}@${result.version}`}
                result={result}
                expanded={expandedRow === result.name}
                onToggle={() =>
                  setExpandedRow(expandedRow === result.name ? null : result.name)
                }
              />
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-gray-600">
                  No packages match your filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Result Row ──────────────────────────────────────────────────────────────

function ResultRow({
  result,
  expanded,
  onToggle,
}: {
  result: HealthResult;
  expanded: boolean;
  onToggle: () => void;
}): React.ReactElement {
  const registryLabel = (() => {
    if (!result.npm_url) return null;
    try {
      const hostname = new URL(result.npm_url).hostname;
      if (hostname === "pypi.org" || hostname.endsWith(".pypi.org")) return "PyPI";
      if (hostname === "crates.io" || hostname.endsWith(".crates.io")) return "crates.io";
      if (hostname === "rubygems.org" || hostname.endsWith(".rubygems.org")) return "RubyGems";
      if (hostname === "pkg.go.dev" || hostname.endsWith(".pkg.go.dev")) return "Go";
      if (hostname === "packagist.org" || hostname.endsWith(".packagist.org")) return "Packagist";
      if (hostname === "mvnrepository.com" || hostname.endsWith(".mvnrepository.com")) return "Maven";
      if (hostname === "pub.dev" || hostname.endsWith(".pub.dev")) return "pub.dev";
      if (hostname === "www.npmjs.com" || hostname === "npmjs.com") return "npm";
      return "npm";
    } catch {
      return "npm";
    }
  })();

  return (
    <>
      <tr
        className="border-b border-gray-800/50 hover:bg-gray-900/30 cursor-pointer"
        onClick={onToggle}
      >
        <td className="p-3 font-medium">
          {result.name}
          {result.is_direct === false && (
            <span className="ml-2 text-[10px] text-gray-600 bg-gray-800 px-1.5 py-0.5 rounded">
              transitive{result.depended_by ? ` of ${result.depended_by}` : ""}
            </span>
          )}
        </td>
        <td className="p-3 text-gray-500 font-mono text-xs">{result.version}</td>
        <td className="p-3">
          {result.health_score !== null ? (
            <ScoreBadge score={result.health_score} />
          ) : (
            <span className="text-gray-600">&mdash;</span>
          )}
        </td>
        <td className="p-3">
          <span
            className={`text-xs font-medium px-2 py-1 rounded ${RISK_BG[result.risk_level]} ${RISK_COLORS[result.risk_level]}`}
          >
            {RISK_LABELS[result.risk_level]}
          </span>
        </td>
        <td className="p-3 space-x-2">
          {result.github_url && (
            <a href={result.github_url} target="_blank" rel="noopener noreferrer"
              className="text-xs text-gray-500 hover:text-white" onClick={(e) => e.stopPropagation()}>
              GitHub
            </a>
          )}
          {result.npm_url && (
            <a href={result.npm_url} target="_blank" rel="noopener noreferrer"
              className="text-xs text-gray-500 hover:text-white" onClick={(e) => e.stopPropagation()}>
              {registryLabel}
            </a>
          )}
        </td>
      </tr>
      {expanded && (result.signals || result.score_breakdown) && (
        <tr className="border-b border-gray-800/50">
          <td colSpan={5} className="p-4 bg-gray-900/20">
            <ExpandedDetails
              signals={result.signals}
              breakdown={result.score_breakdown}
              confidence={result.data_confidence}
            />
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Score Badge ─────────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number }): React.ReactElement {
  let color = "text-red-400";
  if (score >= 80) color = "text-green-400";
  else if (score >= 60) color = "text-blue-400";
  else if (score >= 40) color = "text-yellow-400";
  else if (score >= 20) color = "text-orange-400";

  return <span className={`font-bold font-mono ${color}`}>{score}</span>;
}

// ─── Score Bar ──────────────────────────────────────────────────────────────

function ScoreBar({
  score,
  weight,
  label,
  tooltip,
}: {
  score: number;
  weight: string;
  label: string;
  tooltip: string;
}): React.ReactElement {
  let barColor = "bg-red-400";
  if (score >= 80) barColor = "bg-green-400";
  else if (score >= 60) barColor = "bg-blue-400";
  else if (score >= 40) barColor = "bg-yellow-400";
  else if (score >= 20) barColor = "bg-orange-400";

  return (
    <div className="group relative">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-400 cursor-help border-b border-dotted border-gray-600">
          {label}
          <span className="text-gray-600 ml-1">{weight}</span>
        </span>
        <span className="text-xs font-mono font-medium">{score}</span>
      </div>
      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${score}%` }} />
      </div>
      <div className="absolute bottom-full left-0 mb-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 w-56 leading-relaxed shadow-xl">
        {tooltip}
      </div>
    </div>
  );
}

// ─── Expanded Details ───────────────────────────────────────────────────────

function ExpandedDetails({
  signals,
  breakdown,
  confidence,
}: {
  signals: HealthResult["signals"];
  breakdown: HealthResult["score_breakdown"];
  confidence: HealthResult["data_confidence"];
}): React.ReactElement {
  return (
    <div className="space-y-5">
      {/* Confidence Banner */}
      <div className="flex items-center gap-2">
        <ConfidenceDot confidence={confidence} />
        <span className="text-xs text-gray-400">
          Data confidence:{" "}
          <span className={confidence === "high" ? "text-green-400" : confidence === "low" ? "text-yellow-400" : "text-gray-500"}>
            {confidence}
          </span>
          {confidence === "low" && " - no GitHub repo found, registry-only signals"}
          {confidence === "unavailable" && " - data could not be fetched"}
        </span>
      </div>

      {/* Score Breakdown */}
      {breakdown && (
        <div>
          <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Score Breakdown</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
            <ScoreBar score={breakdown.commit_score} weight="25%" label="Commit Activity"
              tooltip={breakdown.commit_score >= 80
                ? "Active development - commits within the last 90 days."
                : breakdown.commit_score >= 40
                  ? "Slowing down - no commits in 3-6 months. Pin your version and monitor."
                  : "No commits in over a year. Consider migrating to an active alternative."} />
            <ScoreBar score={breakdown.release_score} weight="20%" label="Release Cadence"
              tooltip={breakdown.release_score >= 80
                ? "Healthy release cycle - fixes are reaching published versions."
                : breakdown.release_score >= 40
                  ? "Release slowing - last publish was 6-12 months ago. Check if critical fixes are pending."
                  : "No release in over a year. Bug fixes and security patches aren't reaching users."} />
            <ScoreBar score={breakdown.issue_health_score} weight="15%" label="Issue Health"
              tooltip={breakdown.issue_health_score >= 80
                ? "Maintainer is responsive - most issues get addressed."
                : breakdown.issue_health_score >= 40
                  ? "Growing backlog of open issues. Check if your critical issues are being tracked."
                  : "High ratio of unresolved issues. Maintainer may be unresponsive."} />
            <ScoreBar score={breakdown.contributor_score} weight="15%" label="Contributors (90d)"
              tooltip={breakdown.contributor_score >= 80
                ? "Healthy bus factor - multiple active contributors."
                : breakdown.contributor_score >= 40
                  ? "Few recent contributors. Single point of failure risk."
                  : "Zero or one contributor in 90 days. High risk of sudden abandonment."} />
            <ScoreBar score={breakdown.pr_velocity_score} weight="10%" label="PR Velocity"
              tooltip={breakdown.pr_velocity_score >= 80
                ? "PRs merge quickly - contributions are welcome and reviewed."
                : breakdown.pr_velocity_score >= 40
                  ? "PRs take weeks to merge. Community contributions may be ignored."
                  : "PRs take months or never merge. External contributions are effectively blocked."} />
            <ScoreBar score={breakdown.download_trend_score} weight="10%" label="Download Trend"
              tooltip={breakdown.download_trend_score >= 80
                ? "Growing or stable downloads - the ecosystem trusts this package."
                : breakdown.download_trend_score >= 40
                  ? "Downloads declining 10-30%. The ecosystem may be shifting to alternatives."
                  : "Downloads dropping fast. Developers are actively migrating away."} />
            <ScoreBar score={breakdown.maintainer_score} weight="5%" label="Maintainers"
              tooltip={breakdown.maintainer_score >= 80
                ? "Multiple maintainers - reduced single-point-of-failure risk."
                : "Single maintainer. If they leave, the package dies. Plan accordingly."} />
          </div>
          {breakdown.security_penalty < 1 && (
            <div className="mt-3 px-3 py-2 bg-red-400/10 border border-red-400/20 rounded-lg">
              <span className="text-xs text-red-400 font-medium">
                Security penalty: {Math.round(breakdown.security_penalty * 100)}% multiplier
              </span>
              <span className="text-xs text-gray-500 ml-2">(unpatched CVEs detected)</span>
            </div>
          )}
        </div>
      )}

      {/* Raw Signals */}
      {signals && (
        <div>
          <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Raw Signals</h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <SignalItem label="Last commit" value={signals.days_since_last_commit !== null ? `${signals.days_since_last_commit}d ago` : null} />
            <SignalItem label="Last release" value={signals.days_since_last_release !== null ? `${signals.days_since_last_release}d ago` : null} />
            <SignalItem label="Contributors (90d)" value={signals.contributor_count_90d !== null ? String(signals.contributor_count_90d) : null} />
            <SignalItem label="PR merge velocity" value={signals.pr_merge_velocity_days !== null ? `${signals.pr_merge_velocity_days}d avg` : null} />
            <SignalItem label="Weekly downloads" value={signals.weekly_downloads !== null ? signals.weekly_downloads.toLocaleString() : null} />
            <SignalItem label="Downloads 12w ago" value={signals.weekly_downloads_12w_ago !== null ? signals.weekly_downloads_12w_ago.toLocaleString() : null} />
            <SignalItem label="Multiple maintainers" value={signals.has_multiple_maintainers !== null ? (signals.has_multiple_maintainers ? "Yes" : "No") : null} />
            <SignalItem label="Unpatched CVEs" value={String(signals.unresolved_cves)} />
            <LicenseBadge license={signals.license} />
            {signals.is_deprecated && (
              <div className="flex items-start gap-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 bg-red-400" />
                <div>
                  <div className="text-xs text-gray-500">Status</div>
                  <div className="text-sm font-medium text-red-400">
                    Deprecated
                    <span className="text-gray-600 text-xs ml-1">(maintainer recommends migrating)</span>
                  </div>
                </div>
              </div>
            )}
            {signals.is_archived && (
              <div className="flex items-start gap-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 bg-orange-400" />
                <div>
                  <div className="text-xs text-gray-500">Status</div>
                  <div className="text-sm font-medium text-orange-400">
                    Archived
                    <span className="text-gray-600 text-xs ml-1">(read-only, cannot receive patches)</span>
                  </div>
                </div>
              </div>
            )}
            {signals.is_mature && !signals.is_deprecated && !signals.is_archived && (
              <div className="flex items-start gap-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 bg-blue-400" />
                <div>
                  <div className="text-xs text-gray-500">Status</div>
                  <div className="text-sm font-medium text-blue-400">
                    Mature / Complete
                    <span className="text-gray-600 text-xs ml-1">(stable, widely used, low issues)</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Confidence Dot ─────────────────────────────────────────────────────────

function ConfidenceDot({ confidence }: { confidence: HealthResult["data_confidence"] }): React.ReactElement {
  const color = confidence === "high" ? "bg-green-400" : confidence === "low" ? "bg-yellow-400" : "bg-gray-500";
  return <span className={`inline-block w-2 h-2 rounded-full ${color}`} />;
}

// ─── Signal Item ────────────────────────────────────────────────────────────

// ─── License Badge ──────────────────────────────────────────────────────────

const RESTRICTIVE_LICENSES = new Set([
  "GPL-2.0", "GPL-3.0", "GPL-2.0-only", "GPL-3.0-only",
  "GPL-2.0-or-later", "GPL-3.0-or-later",
  "AGPL-3.0", "AGPL-3.0-only", "AGPL-3.0-or-later",
  "LGPL-2.1", "LGPL-3.0", "LGPL-2.1-only", "LGPL-3.0-only",
  "SSPL-1.0", "EUPL-1.2", "MPL-2.0",
]);

const PERMISSIVE_LICENSES = new Set([
  "MIT", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause",
  "ISC", "0BSD", "Unlicense", "CC0-1.0", "Zlib",
]);

function classifyLicense(license: string): "permissive" | "restrictive" | "unknown" {
  const normalized = license.trim();
  if (PERMISSIVE_LICENSES.has(normalized)) return "permissive";
  if (RESTRICTIVE_LICENSES.has(normalized)) return "restrictive";
  // Check partial matches
  if (/\bMIT\b/i.test(normalized) || /\bApache/i.test(normalized) || /\bBSD\b/i.test(normalized) || /\bISC\b/i.test(normalized)) return "permissive";
  if (/\bGPL\b/i.test(normalized) || /\bAGPL\b/i.test(normalized) || /\bSSPL\b/i.test(normalized)) return "restrictive";
  return "unknown";
}

function LicenseBadge({ license }: { license: string | null }): React.ReactElement {
  if (!license) {
    return (
      <div className="flex items-start gap-1.5">
        <span className="inline-block w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 bg-gray-600" />
        <div>
          <div className="text-xs text-gray-500">License</div>
          <div className="text-sm font-medium text-gray-600">No data</div>
        </div>
      </div>
    );
  }

  const classification = classifyLicense(license);
  const color = classification === "permissive" ? "text-green-400" : classification === "restrictive" ? "text-orange-400" : "text-gray-400";
  const dotColor = classification === "permissive" ? "bg-green-400" : classification === "restrictive" ? "bg-orange-400" : "bg-gray-500";
  const hint = classification === "restrictive" ? " (copyleft)" : classification === "permissive" ? " (permissive)" : "";

  return (
    <div className="flex items-start gap-1.5">
      <span className={`inline-block w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${dotColor}`} />
      <div>
        <div className="text-xs text-gray-500">License</div>
        <div className={`text-sm font-medium ${color}`}>
          {license}
          <span className="text-gray-600 text-xs ml-1">{hint}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Signal Item ────────────────────────────────────────────────────────────

function SignalItem({ label, value }: { label: string; value: string | null }): React.ReactElement {
  return (
    <div className="flex items-start gap-1.5">
      <span className={`inline-block w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${value !== null ? "bg-green-400" : "bg-gray-600"}`} />
      <div>
        <div className="text-xs text-gray-500">{label}</div>
        <div className={`text-sm font-medium ${value === null ? "text-gray-600" : ""}`}>{value ?? "No data"}</div>
      </div>
    </div>
  );
}
