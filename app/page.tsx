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

const ECOSYSTEMS = [
  { name: "npm", file: "package.json", color: "text-red-400" },
  { name: "PyPI", file: "requirements.txt", color: "text-blue-400" },
  { name: "Cargo", file: "Cargo.toml", color: "text-orange-400" },
  { name: "Go", file: "go.mod", color: "text-cyan-400" },
  { name: "RubyGems", file: "Gemfile", color: "text-red-300" },
  { name: "PHP", file: "composer.json", color: "text-purple-400" },
  { name: "Java", file: "build.gradle", color: "text-amber-400" },
  { name: "Dart", file: "pubspec.yaml", color: "text-sky-400" },
];

const STEPS = [
  {
    num: "1",
    title: "Drop your file",
    desc: "Upload any dependency file. It never leaves your browser.",
  },
  {
    num: "2",
    title: "We fetch the signals",
    desc: "Commits, releases, contributors, downloads, CVEs — all from public APIs.",
  },
  {
    num: "3",
    title: "Get the verdict",
    desc: "Every package scored 0–100 with a full breakdown of why.",
  },
];

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

  // ─── Landing Page ─────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <section className="flex flex-col items-center justify-center px-8 pt-24 pb-16">
        <div className="max-w-3xl w-full text-center">
          <p className="text-sm font-medium text-blue-400 mb-4 tracking-wider uppercase">
            Dependency Health Scanner
          </p>
          <h1 className="text-5xl sm:text-6xl font-bold mb-4 tracking-tight leading-tight">
            Your dependencies
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-400 via-orange-400 to-yellow-400">
              are dying.
            </span>
          </h1>
          <p className="text-lg text-gray-400 mb-10 max-w-xl mx-auto">
            npm audit catches CVEs. Dependabot sends PRs.
            <br />
            <span className="text-gray-300">Nothing catches abandonment.</span>
          </p>

          {/* Drop Zone */}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            className={`max-w-xl mx-auto border-2 border-dashed rounded-xl p-10 transition-all cursor-pointer ${
              dragOver
                ? "border-blue-500 bg-blue-500/10 scale-[1.02]"
                : "border-gray-700 hover:border-gray-500"
            }`}
          >
            <label className="cursor-pointer block">
              <input
                type="file"
                accept=".json,.txt,.toml,.mod,.lock,.gradle,.kts,.yaml,.yml"
                onChange={handleFileInput}
                className="hidden"
              />
              <div className="text-gray-400">
                <div className="w-12 h-12 mx-auto mb-4 rounded-lg bg-gray-800 flex items-center justify-center">
                  <svg className="w-6 h-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                </div>
                <p className="text-base mb-1">
                  Drop your dependency file here
                </p>
                <p className="text-sm text-gray-600">or click to browse</p>
              </div>
            </label>
          </div>

          <p className="text-xs text-gray-600 mt-3">
            Your file never leaves your browser. Parsed client-side. No account needed.
          </p>

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
                className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors text-lg"
              >
                Analyze Health
              </button>
            </div>
          )}

          {/* Loading State */}
          {state.step === "loading" && (
            <div className="mt-8">
              <div className="inline-block w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-gray-400 mt-3">Analyzing dependencies...</p>
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
      </section>

      {/* Supported Ecosystems */}
      <section className="flex justify-center gap-6 sm:gap-10 pb-16 px-8 flex-wrap">
        {ECOSYSTEMS.map((eco) => (
          <div key={eco.name} className="text-center">
            <p className={`text-sm font-medium ${eco.color}`}>{eco.name}</p>
            <p className="text-xs text-gray-600 font-mono">{eco.file}</p>
          </div>
        ))}
      </section>

      {/* How It Works */}
      <section className="max-w-4xl mx-auto px-8 pb-20">
        <h2 className="text-center text-sm font-medium text-gray-500 uppercase tracking-wider mb-10">
          How it works
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          {STEPS.map((step) => (
            <div key={step.num} className="text-center">
              <div className="w-10 h-10 mx-auto mb-4 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-sm font-bold text-gray-400">
                {step.num}
              </div>
              <h3 className="font-medium mb-2">{step.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Scoring Table */}
      <section className="max-w-2xl mx-auto px-8 pb-20">
        <h2 className="text-center text-sm font-medium text-gray-500 uppercase tracking-wider mb-8">
          What we measure
        </h2>
        <div className="border border-gray-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <tbody>
              {[
                { signal: "Commit activity", weight: "25%", icon: "green" },
                { signal: "Release cadence", weight: "20%", icon: "blue" },
                { signal: "Issue responsiveness", weight: "15%", icon: "yellow" },
                { signal: "Active contributors", weight: "15%", icon: "orange" },
                { signal: "PR merge velocity", weight: "10%", icon: "purple" },
                { signal: "Download trend", weight: "10%", icon: "cyan" },
                { signal: "Maintainer count", weight: "5%", icon: "pink" },
              ].map((row, i) => (
                <tr
                  key={row.signal}
                  className={i < 6 ? "border-b border-gray-800/50" : ""}
                >
                  <td className="p-3 flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full bg-${row.icon}-400`}
                    />
                    {row.signal}
                  </td>
                  <td className="p-3 text-right text-gray-500 font-mono">
                    {row.weight}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-center text-xs text-gray-600 mt-3">
          Unresolved CVEs apply a security penalty multiplier on top.
        </p>
      </section>

      {/* CTA: CI + Badges */}
      <section className="max-w-4xl mx-auto px-8 pb-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-6 bg-gray-900/50 border border-gray-800 rounded-lg">
            <h3 className="font-medium mb-2">CI Integration</h3>
            <p className="text-sm text-gray-500 mb-4">
              Fail builds when dependencies drop below your threshold.
            </p>
            <code className="text-xs text-gray-400 bg-gray-800 px-3 py-2 rounded block overflow-x-auto">
              uses: KidCarmi/Dependency-Obituary@main
            </code>
          </div>
          <div className="p-6 bg-gray-900/50 border border-gray-800 rounded-lg">
            <h3 className="font-medium mb-2">README Badges</h3>
            <p className="text-sm text-gray-500 mb-4">
              Show health scores for any package in your docs.
            </p>
            <a
              href="/badge"
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              Generate a badge &rarr;
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center pb-12 text-xs text-gray-700">
        Built in public. $0 to run. No VC. No bullshit.
      </footer>
    </main>
  );
}
