"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { AnalyzeResponse } from "@/types";
import ResultsDashboard from "../results/ResultsDashboard";

interface SharedReport {
  data: AnalyzeResponse;
  ecosystem: string;
  filename: string;
  created_at: string;
}

export default function SharePage(): React.ReactElement {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const [report, setReport] = useState<SharedReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      setError("No report ID provided.");
      setLoading(false);
      return;
    }

    fetch(`/api/share?id=${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Report not found or expired.");
        return res.json();
      })
      .then((data: SharedReport) => {
        setReport(data);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  if (error || !report) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-8">
        <h1 className="text-2xl font-bold mb-2">Report Not Found</h1>
        <p className="text-gray-400 mb-6">{error || "This report may have expired."}</p>
        <a href="/" className="text-sm text-blue-400 hover:underline">
          Analyze your own dependencies &rarr;
        </a>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <a
          href="/"
          className="text-sm text-gray-400 hover:text-white transition-colors"
        >
          &larr; Analyze your own file
        </a>
        <div className="text-right">
          <p className="text-xs text-gray-600">
            Shared report &middot; {report.filename}
          </p>
          <p className="text-xs text-gray-700">
            {new Date(report.created_at).toLocaleDateString()}
          </p>
        </div>
      </div>
      <ResultsDashboard data={report.data} />
    </main>
  );
}
