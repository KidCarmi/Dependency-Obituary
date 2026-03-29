"use client";

import { useState, useMemo } from "react";
import type {
  AnalyzeResponse,
  HealthResult,
  RiskLevel,
  ScoreBreakdownResponse,
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
  abandoned: "Abandoned",
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

  const riskCounts = useMemo(() => {
    const counts: Record<RiskLevel, number> = {
      healthy: 0,
      stable: 0,
      at_risk: 0,
      critical: 0,
      abandoned: 0,
      unknown: 0,
    };
    for (const r of data.results) {
      counts[r.risk_level]++;
    }
    return counts;
  }, [data.results]);

  const sorted = useMemo(() => {
    const riskOrder: Record<RiskLevel, number> = {
      abandoned: 0,
      critical: 1,
      at_risk: 2,
      stable: 3,
      healthy: 4,
      unknown: 5,
    };

    return [...data.results].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") {
        cmp = a.name.localeCompare(b.name);
      } else if (sortKey === "health_score") {
        cmp = (a.health_score ?? -1) - (b.health_score ?? -1);
      } else {
        cmp = riskOrder[a.risk_level] - riskOrder[b.risk_level];
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [data.results, sortKey, sortDir]);

  const handleSort = (key: SortKey): void => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "asc");
    }
  };

  const sortArrow = (key: SortKey): string => {
    if (sortKey !== key) return "";
    return sortDir === "asc" ? " \u2191" : " \u2193";
  };

  return (
    <div>
      {/* Header */}
      <h1 className="text-2xl font-bold mb-1">Health Report</h1>
      <p className="text-sm text-gray-500 mb-6">
        Analyzed {data.results.length} packages &middot;{" "}
        {Math.round(data.meta.cache_hit_rate * 100)}% cache hits
        {data.meta.degraded_count > 0 && (
          <span className="text-yellow-500">
            {" "}&middot; {data.meta.degraded_count} unavailable
          </span>
        )}
      </p>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mb-8">
        {(
          ["healthy", "stable", "at_risk", "critical", "abandoned"] as const
        ).map((level) => (
          <div
            key={level}
            className={`rounded-lg p-4 ${RISK_BG[level]}`}
          >
            <div className={`text-2xl font-bold ${RISK_COLORS[level]}`}>
              {riskCounts[level]}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              {RISK_LABELS[level]}
            </div>
          </div>
        ))}
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
              <th className="text-left p-3 text-gray-400 font-medium">
                Version
              </th>
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
              <th className="text-left p-3 text-gray-400 font-medium">
                Links
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((result) => (
              <ResultRow
                key={`${result.name}@${result.version}`}
                result={result}
                expanded={expandedRow === result.name}
                onToggle={() =>
                  setExpandedRow(
                    expandedRow === result.name ? null : result.name
                  )
                }
              />
            ))}
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
  return (
    <>
      <tr
        className="border-b border-gray-800/50 hover:bg-gray-900/30 cursor-pointer"
        onClick={onToggle}
      >
        <td className="p-3 font-medium">{result.name}</td>
        <td className="p-3 text-gray-500 font-mono text-xs">
          {result.version}
        </td>
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
            <a
              href={result.github_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-gray-500 hover:text-white"
              onClick={(e) => e.stopPropagation()}
            >
              GitHub
            </a>
          )}
          {result.npm_url && (
            <a
              href={result.npm_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-gray-500 hover:text-white"
              onClick={(e) => e.stopPropagation()}
            >
              {result.npm_url.includes("pypi") ? "PyPI" : "npm"}
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
        <div
          className={`h-full rounded-full ${barColor} transition-all`}
          style={{ width: `${score}%` }}
        />
      </div>
      {/* Tooltip */}
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
          <span
            className={
              confidence === "high"
                ? "text-green-400"
                : confidence === "low"
                  ? "text-yellow-400"
                  : "text-gray-500"
            }
          >
            {confidence}
          </span>
          {confidence === "low" && " — no GitHub repo found, npm-only signals"}
          {confidence === "unavailable" && " — data could not be fetched"}
        </span>
      </div>

      {/* Score Breakdown */}
      {breakdown && (
        <div>
          <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
            Score Breakdown
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
            <ScoreBar
              score={breakdown.commit_score}
              weight="25%"
              label="Commit Activity"
              tooltip="Is anyone actively committing? Based on days since last commit. Recent commits (< 30d) score 100, > 1 year scores 0."
            />
            <ScoreBar
              score={breakdown.release_score}
              weight="20%"
              label="Release Cadence"
              tooltip="Are fixes reaching published versions? Based on days since last release. Recent release (< 60d) scores 100, > 2 years scores 0."
            />
            <ScoreBar
              score={breakdown.issue_health_score}
              weight="15%"
              label="Issue Health"
              tooltip="Is the maintainer responsive? Measures open vs closed issue ratio. Lower open ratio = healthier project."
            />
            <ScoreBar
              score={breakdown.contributor_score}
              weight="15%"
              label="Contributors (90d)"
              tooltip="Bus factor — is this a single-maintainer project? 0 contributors = 0, 1 = 30 (risk), 5-10 = 85, 10+ = 100."
            />
            <ScoreBar
              score={breakdown.pr_velocity_score}
              weight="10%"
              label="PR Velocity"
              tooltip="How quickly are PRs merged? < 3 days avg = 100, > 90 days = 0. No merged PRs = insufficient data."
            />
            <ScoreBar
              score={breakdown.download_trend_score}
              weight="10%"
              label="Download Trend"
              tooltip="Is the ecosystem migrating away? Compares current week vs 12 weeks ago. Growing > 10% = 100, declining > 30% = 15."
            />
            <ScoreBar
              score={breakdown.maintainer_score}
              weight="5%"
              label="Maintainers"
              tooltip="Multiple maintainers reduce single-point-of-failure risk. Multiple = 100, single = 30."
            />
          </div>
          {breakdown.security_penalty < 1 && (
            <div className="mt-3 px-3 py-2 bg-red-400/10 border border-red-400/20 rounded-lg">
              <span className="text-xs text-red-400 font-medium">
                Security penalty: {Math.round(breakdown.security_penalty * 100)}% multiplier
              </span>
              <span className="text-xs text-gray-500 ml-2">
                (unresolved CVEs detected)
              </span>
            </div>
          )}
        </div>
      )}

      {/* Raw Signals */}
      {signals && (
        <div>
          <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
            Raw Signals
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <SignalItem
              label="Last commit"
              value={
                signals.days_since_last_commit !== null
                  ? `${signals.days_since_last_commit}d ago`
                  : null
              }
            />
            <SignalItem
              label="Last release"
              value={
                signals.days_since_last_release !== null
                  ? `${signals.days_since_last_release}d ago`
                  : null
              }
            />
            <SignalItem
              label="Contributors (90d)"
              value={
                signals.contributor_count_90d !== null
                  ? String(signals.contributor_count_90d)
                  : null
              }
            />
            <SignalItem
              label="PR merge velocity"
              value={
                signals.pr_merge_velocity_days !== null
                  ? `${signals.pr_merge_velocity_days}d avg`
                  : null
              }
            />
            <SignalItem
              label="Weekly downloads"
              value={
                signals.weekly_downloads !== null
                  ? signals.weekly_downloads.toLocaleString()
                  : null
              }
            />
            <SignalItem
              label="Downloads 12w ago"
              value={
                signals.weekly_downloads_12w_ago !== null
                  ? signals.weekly_downloads_12w_ago.toLocaleString()
                  : null
              }
            />
            <SignalItem
              label="Multiple maintainers"
              value={
                signals.has_multiple_maintainers !== null
                  ? signals.has_multiple_maintainers
                    ? "Yes"
                    : "No"
                  : null
              }
            />
            <SignalItem
              label="Unresolved CVEs"
              value={String(signals.unresolved_cves)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Confidence Dot ─────────────────────────────────────────────────────────

function ConfidenceDot({
  confidence,
}: {
  confidence: HealthResult["data_confidence"];
}): React.ReactElement {
  const color =
    confidence === "high"
      ? "bg-green-400"
      : confidence === "low"
        ? "bg-yellow-400"
        : "bg-gray-500";

  return <span className={`inline-block w-2 h-2 rounded-full ${color}`} />;
}

// ─── Signal Item with confidence indicator ──────────────────────────────────

function SignalItem({
  label,
  value,
}: {
  label: string;
  value: string | null;
}): React.ReactElement {
  return (
    <div className="flex items-start gap-1.5">
      <span
        className={`inline-block w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
          value !== null ? "bg-green-400" : "bg-gray-600"
        }`}
      />
      <div>
        <div className="text-xs text-gray-500">{label}</div>
        <div className={`text-sm font-medium ${value === null ? "text-gray-600" : ""}`}>
          {value ?? "No data"}
        </div>
      </div>
    </div>
  );
}
