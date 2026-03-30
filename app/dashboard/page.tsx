"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect, useCallback } from "react";
import type { WatchlistEntry, AnalyzeResponse } from "@/types";
import ResultsDashboard from "../results/ResultsDashboard";

export default function DashboardPage(): React.ReactElement {
  const { data: session, status } = useSession();
  const [entries, setEntries] = useState<WatchlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<{
    entry: WatchlistEntry;
    data: AnalyzeResponse;
  } | null>(null);

  const fetchWatchlist = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/watchlist");
    if (res.ok) {
      const data = await res.json();
      setEntries(data.entries || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (status === "authenticated") {
      fetchWatchlist();
    } else {
      setLoading(false);
    }
  }, [status, fetchWatchlist]);

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
          onClick={() => {
            // next-auth client-side redirect
            window.location.href = "/api/auth/signin";
          }}
          className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
        >
          Sign in with GitHub
        </button>
      </main>
    );
  }

  // ─── Loading ────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  // ─── Analysis result view ───────────────────────────────────────────────

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
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-gray-500">
            {entries.length} watched project{entries.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

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
                  Added{" "}
                  {new Date(entry.created_at).toLocaleDateString()}
                  {entry.last_checked && (
                    <>
                      {" "}
                      &middot; Last checked{" "}
                      {new Date(entry.last_checked).toLocaleDateString()}
                    </>
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
    </main>
  );
}
