"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import type { WatchlistEntry, AnalyzeResponse } from "@/types";
import ResultsDashboard from "../results/ResultsDashboard";

interface ActivityEvent {
  type: string;
  repo: string;
  pr_number: number;
  file: string;
  packages_total: number;
  packages_critical: number;
  packages_healthy: number;
  timestamp: string;
}

export default function DashboardPage(): React.ReactElement {
  const { data: session, status } = useSession();
  const [entries, setEntries] = useState<WatchlistEntry[]>([]);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"watchlist" | "activity">("watchlist");
  const [analysisResult, setAnalysisResult] = useState<{
    entry: WatchlistEntry;
    data: AnalyzeResponse;
  } | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [watchlistRes, activityRes] = await Promise.all([
      fetch("/api/watchlist"),
      fetch("/api/activity"),
    ]);
    if (watchlistRes.ok) {
      const data = await watchlistRes.json();
      setEntries(data.entries || []);
    }
    if (activityRes.ok) {
      const data = await activityRes.json();
      setActivity(data.events || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (status === "authenticated") {
      fetchData();
    } else {
      setLoading(false);
    }
  }, [status, fetchData]);

  const handleDelete = useCallback(
    async (id: string) => {
      await fetch(`/api/watchlist?id=${id}`, { method: "DELETE" });
      setEntries((prev) => prev.filter((e) => e.id !== id));
      if (analysisResult?.entry.id === id) {
        setAnalysisResult(null);
      }
    },
    [analysisResult]
  );

  const handleAnalyze = useCallback(async (entry: WatchlistEntry) => {
    setAnalyzing(entry.id);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ecosystem: entry.ecosystem,
          packages: entry.packages,
        }),
      });
      const data: AnalyzeResponse = await res.json();
      setAnalysisResult({ entry, data });
    } catch {
      // Silently fail — user can retry
    }
    setAnalyzing(null);
  }, []);

  // ─── Not authenticated ──────────────────────────────────────────────────

  if (status === "unauthenticated") {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-8">
        <h1 className="text-2xl font-bold mb-2">Dashboard</h1>
        <p className="text-gray-400 mb-6">
          Sign in with GitHub to save and monitor your dependency lists.
        </p>
        <button
          onClick={() => { window.location.href = "/api/auth/signin"; }}
          className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
        >
          Sign in with GitHub
        </button>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  if (analysisResult) {
    return (
      <main className="min-h-screen p-8 max-w-6xl mx-auto">
        <button
          onClick={() => setAnalysisResult(null)}
          className="mb-6 text-sm text-gray-400 hover:text-white transition-colors"
        >
          &larr; Back to dashboard
        </button>
        <p className="text-xs text-gray-500 mb-2">
          Project: {analysisResult.entry.name}
        </p>
        <ResultsDashboard data={analysisResult.data} />
      </main>
    );
  }

  // ─── Dashboard ──────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Link
          href="/integrations"
          className="px-3 py-1.5 text-xs bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 rounded-lg transition-colors"
        >
          Install GitHub App
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-900 rounded-lg p-1 w-fit">
        <button
          onClick={() => setActiveTab("watchlist")}
          className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
            activeTab === "watchlist"
              ? "bg-gray-800 text-white"
              : "text-gray-500 hover:text-gray-300"
          }`}
        >
          Watchlist ({entries.length})
        </button>
        <button
          onClick={() => setActiveTab("activity")}
          className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
            activeTab === "activity"
              ? "bg-gray-800 text-white"
              : "text-gray-500 hover:text-gray-300"
          }`}
        >
          PR Activity {activity.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 text-xs bg-blue-600/20 text-blue-400 rounded">
              {activity.length}
            </span>
          )}
        </button>
      </div>

      {/* Watchlist Tab */}
      {activeTab === "watchlist" && (
        <>
          {entries.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-gray-800 rounded-xl">
              <p className="text-gray-500 mb-4">No watched projects yet.</p>
              <p className="text-sm text-gray-600">
                Upload a dependency file on the{" "}
                <a href="/" className="text-blue-400 hover:underline">
                  home page
                </a>
                , then save it to your watchlist from the results.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between p-4 bg-gray-900/50 border border-gray-800 rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <h3 className="font-medium truncate">{entry.name}</h3>
                      <span className="text-xs px-2 py-0.5 bg-gray-800 text-gray-400 rounded">
                        {entry.ecosystem}
                      </span>
                      <span className="text-xs text-gray-600">
                        {entry.packages.length} packages
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">
                      Added {new Date(entry.created_at).toLocaleDateString()}
                      {entry.last_checked && (
                        <> &middot; Last checked {new Date(entry.last_checked).toLocaleDateString()}</>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => handleAnalyze(entry)}
                      disabled={analyzing === entry.id}
                      className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 text-white rounded-lg transition-colors"
                    >
                      {analyzing === entry.id ? "Analyzing..." : "Check now"}
                    </button>
                    <button
                      onClick={() => handleDelete(entry.id)}
                      className="px-3 py-1.5 text-xs text-gray-500 hover:text-red-400 hover:bg-gray-800 rounded-lg transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Activity Tab */}
      {activeTab === "activity" && (
        <>
          {activity.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-gray-800 rounded-xl">
              <p className="text-gray-500 mb-4">No PR activity yet.</p>
              <p className="text-sm text-gray-600">
                <Link href="/integrations" className="text-blue-400 hover:underline">
                  Install the GitHub App
                </Link>
                {" "}to see health reports from your PRs here.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {activity.map((event, i) => {
                const timeAgo = getTimeAgo(event.timestamp);
                return (
                  <div
                    key={`${event.repo}-${event.pr_number}-${i}`}
                    className="flex items-center justify-between p-3 bg-gray-900/50 border border-gray-800 rounded-lg"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">
                          {event.repo}
                        </span>
                        <a
                          href={`https://github.com/${event.repo}/pull/${event.pr_number}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-gray-500 hover:text-blue-400"
                        >
                          #{event.pr_number}
                        </a>
                      </div>
                      <p className="text-xs text-gray-600 mt-0.5">
                        {event.packages_total} packages analyzed from {event.file}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 ml-4">
                      {event.packages_critical > 0 && (
                        <span className="text-xs text-red-400 font-medium">
                          {event.packages_critical} critical
                        </span>
                      )}
                      <span className="text-xs text-green-400">
                        {event.packages_healthy} healthy
                      </span>
                      <span className="text-xs text-gray-600">{timeAgo}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </main>
  );
}

function getTimeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
