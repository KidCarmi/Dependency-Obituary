"use client";

import { useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { parseFile } from "@/lib/parser";
import type { AnalyzeResponse, Package, Ecosystem } from "@/types";
import ResultsDashboard from "./results/ResultsDashboard";

type AppState =
  | { step: "upload" }
  | { step: "parsed"; ecosystem: Ecosystem; packages: Package[]; filename: string }
  | { step: "loading"; ecosystem: Ecosystem; packages: Package[]; filename: string }
  | { step: "results"; data: AnalyzeResponse; ecosystem: Ecosystem; packages: Package[]; filename: string }
  | { step: "error"; message: string };

export default function HomePage(): React.ReactElement {
  const { data: session } = useSession();
  const [state, setState] = useState<AppState>({ step: "upload" });
  const [dragOver, setDragOver] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result;
      if (typeof content !== "string") return;

      const { ecosystem, packages } = parseFile(file.name, content);
      if (packages.length === 0) {
        setState({ step: "error", message: "No dependencies found in file." });
        return;
      }
      setState({ step: "parsed", ecosystem, packages, filename: file.name });
      setSaved(false);
    };
    reader.readAsText(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleAnalyze = useCallback(async () => {
    if (state.step !== "parsed") return;

    const { ecosystem, packages, filename } = state;
    setState({ step: "loading", ecosystem, packages, filename });

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ecosystem, packages }),
      });

      const data: AnalyzeResponse = await res.json();
      setState({ step: "results", data, ecosystem, packages, filename });
    } catch {
      setState({ step: "error", message: "Analysis failed. Please try again." });
    }
  }, [state]);

  const handleSaveToWatchlist = useCallback(async () => {
    if (state.step !== "results") return;

    const res = await fetch("/api/watchlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: state.filename.replace(/\.[^.]+$/, ""),
        ecosystem: state.ecosystem,
        filename: state.filename,
        packages: state.packages,
      }),
    });

    if (res.ok) setSaved(true);
  }, [state]);

  const handleReset = useCallback(() => {
    setState({ step: "upload" });
  }, []);

  // ─── Results View ──────────────────────────────────────────────────────────

  if (state.step === "results") {
    return (
      <main className="min-h-screen p-8 max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={handleReset}
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            &larr; Analyze another file
          </button>
          {session && (
            <button
              onClick={handleSaveToWatchlist}
              disabled={saved}
              className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                saved
                  ? "bg-green-600/20 text-green-400 cursor-default"
                  : "bg-gray-800 hover:bg-gray-700 text-gray-300"
              }`}
            >
              {saved ? "Saved to dashboard" : "Save to watchlist"}
            </button>
          )}
        </div>
        <ResultsDashboard data={state.data} />
      </main>
    );
  }

  // ─── Upload / Parsed / Loading / Error View ────────────────────────────────

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="max-w-2xl w-full text-center">
        <h1 className="text-4xl font-bold mb-2 tracking-tight">
          Dependency Obituary
        </h1>
        <p className="text-gray-400 mb-8">
          Your dependencies are dying. You just don&apos;t know it yet.
        </p>

        {/* Drop Zone */}
        <div
          onDrop={handleDrop}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          className={`border-2 border-dashed rounded-xl p-12 transition-colors cursor-pointer ${
            dragOver
              ? "border-blue-500 bg-blue-500/10"
              : "border-gray-700 hover:border-gray-500"
          }`}
        >
          <label className="cursor-pointer block">
            <input
              type="file"
              accept=".json,.txt,.toml,.mod,.lock"
              onChange={handleFileInput}
              className="hidden"
            />
            <div className="text-gray-400">
              <p className="text-lg mb-2">
                Drop your dependency file
              </p>
              <p className="text-sm text-gray-500">
                <code className="text-gray-400">package.json</code>{" "}
                <code className="text-gray-400">requirements.txt</code>{" "}
                <code className="text-gray-400">Cargo.toml</code>{" "}
                <code className="text-gray-400">go.mod</code>{" "}
                <code className="text-gray-400">Gemfile</code>
              </p>
              <p className="text-sm mt-2">or click to browse</p>
            </div>
          </label>
        </div>

        <p className="text-xs text-gray-600 mt-3">
          Your file never leaves your browser. We parse it client-side.
        </p>

        <a
          href="/badge"
          className="inline-block mt-4 text-xs text-gray-500 hover:text-blue-400 transition-colors"
        >
          Want badges for your README? &rarr;
        </a>

        {/* Parsed State */}
        {state.step === "parsed" && (
          <div className="mt-8 space-y-4">
            <p className="text-gray-300">
              Found{" "}
              <span className="text-white font-semibold">
                {state.packages.length}
              </span>{" "}
              {state.ecosystem} dependencies
            </p>
            <button
              onClick={handleAnalyze}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors"
            >
              Analyze Health
            </button>
          </div>
        )}

        {/* Loading State */}
        {state.step === "loading" && (
          <div className="mt-8">
            <div className="inline-block w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-400 mt-3">
              Analyzing dependencies...
            </p>
          </div>
        )}

        {/* Error State */}
        {state.step === "error" && (
          <div className="mt-8 space-y-4">
            <p className="text-red-400">{state.message}</p>
            <button
              onClick={handleReset}
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Try again
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
