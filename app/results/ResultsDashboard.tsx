"use client";

import { useState, useMemo } from "react";
import type { AnalyzeResponse, HealthResult, RiskLevel } from "@/types";

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
            <span className="text-gray-600">—</span>
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
      {expanded && result.signals && (
        <tr className="border-b border-gray-800/50">
          <td colSpan={5} className="p-4 bg-gray-900/20">
            <SignalDetails signals={result.signals} />
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

// ─── Signal Details ──────────────────────────────────────────────────────────

function SignalDetails({
  signals,
}: {
  signals: NonNullable<HealthResult["signals"]>;
}): React.ReactElement {
  const items = [
    {
      label: "Last commit",
      value:
        signals.days_since_last_commit !== null
          ? `${signals.days_since_last_commit}d ago`
          : "Unknown",
    },
    {
      label: "Last release",
      value:
        signals.days_since_last_release !== null
          ? `${signals.days_since_last_release}d ago`
          : "Unknown",
    },
    {
      label: "Contributors (90d)",
      value:
        signals.contributor_count_90d !== null
          ? String(signals.contributor_count_90d)
          : "Unknown",
    },
    {
      label: "PR merge velocity",
      value:
        signals.pr_merge_velocity_days !== null
          ? `${signals.pr_merge_velocity_days}d`
          : "Unknown",
    },
    {
      label: "Weekly downloads",
      value:
        signals.weekly_downloads !== null
          ? signals.weekly_downloads.toLocaleString()
          : "Unknown",
    },
    {
      label: "Downloads 12w ago",
      value:
        signals.weekly_downloads_12w_ago !== null
          ? signals.weekly_downloads_12w_ago.toLocaleString()
          : "Unknown",
    },
    {
      label: "Multiple maintainers",
      value:
        signals.has_multiple_maintainers !== null
          ? signals.has_multiple_maintainers
            ? "Yes"
            : "No"
          : "Unknown",
    },
    {
      label: "Unresolved CVEs",
      value: String(signals.unresolved_cves),
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {items.map((item) => (
        <div key={item.label}>
          <div className="text-xs text-gray-500">{item.label}</div>
          <div className="text-sm font-medium">{item.value}</div>
        </div>
      ))}
    </div>
  );
}
