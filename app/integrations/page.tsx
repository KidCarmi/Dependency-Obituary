"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";

const APP_SLUG = process.env.NEXT_PUBLIC_GITHUB_APP_SLUG || "dependency-obituary-bot";

const SAMPLE_COMMENT = `## 🪦 Dependency Obituary

⚠️ **2 critical/abandoned** packages detected

| Package | Version | Score | Status |
|---|---|---|---|
| moment | 2.30.1 | 19 | 🔴 abandoned |
| left-pad | 1.3.0 | 34 | 🟠 critical |
| axios | 1.6.0 | 78 | 🔵 stable |
| express | 4.18.2 | 85 | 🟢 healthy |
| react | 19.2.4 | 95 | 🟢 healthy |

<sub>Analyzed \`package.json\` · 5 packages · View full report</sub>`;

const FEATURES = [
  {
    title: "Auto-analyzes PRs",
    desc: "Every PR that touches a dependency file gets a health report comment — automatically.",
  },
  {
    title: "Updates on push",
    desc: "Push new commits? The comment updates. No duplicate comments, ever.",
  },
  {
    title: "8 ecosystems",
    desc: "package.json, requirements.txt, Cargo.toml, go.mod, Gemfile, composer.json, build.gradle, pubspec.yaml.",
  },
  {
    title: "Per-repo rate limits",
    desc: "Uses its own API quota — doesn't consume your personal GitHub token.",
  },
];

const STEPS = [
  { num: "1", text: "Click Install below" },
  { num: "2", text: "Choose which repos to enable" },
  { num: "3", text: "Open a PR that changes a dependency file" },
  { num: "4", text: "Bot comments with the health report" },
];

export default function IntegrationsPage(): React.ReactElement {
  const { data: session } = useSession();

  return (
    <main className="min-h-screen p-8 max-w-4xl mx-auto">
      <Link
        href={session ? "/dashboard" : "/"}
        className="text-sm text-gray-400 hover:text-white transition-colors"
      >
        &larr; Back
      </Link>

      {/* Hero */}
      <div className="mt-8 mb-12 text-center">
        <h1 className="text-3xl font-bold mb-3">GitHub App</h1>
        <p className="text-gray-400 max-w-lg mx-auto">
          Get automatic dependency health reports on every pull request.
          No config files. No CI setup. Just install and go.
        </p>
        <a
          href={`https://github.com/apps/${APP_SLUG}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block mt-6 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors"
        >
          Install on GitHub
        </a>
      </div>

      {/* How it works */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-12">
        {STEPS.map((step) => (
          <div key={step.num} className="text-center">
            <div className="w-8 h-8 mx-auto mb-2 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-sm font-bold text-gray-400">
              {step.num}
            </div>
            <p className="text-sm text-gray-400">{step.text}</p>
          </div>
        ))}
      </div>

      {/* PR Comment Preview */}
      <div className="mb-12">
        <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4 text-center">
          What your PR will look like
        </h2>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 overflow-x-auto">
          <div className="flex items-center gap-2 mb-4 pb-4 border-b border-gray-800">
            <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold">
              🪦
            </div>
            <div>
              <span className="text-sm font-medium">dependency-obituary-bot</span>
              <span className="text-xs text-gray-500 ml-2">bot</span>
            </div>
          </div>
          <div className="prose prose-invert prose-sm max-w-none">
            <pre className="whitespace-pre-wrap text-xs text-gray-300 font-mono leading-relaxed">
              {SAMPLE_COMMENT}
            </pre>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-12">
        {FEATURES.map((f) => (
          <div
            key={f.title}
            className="p-4 bg-gray-900/50 border border-gray-800 rounded-lg"
          >
            <h3 className="font-medium mb-1 text-sm">{f.title}</h3>
            <p className="text-xs text-gray-500">{f.desc}</p>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="text-center pb-12">
        <a
          href={`https://github.com/apps/${APP_SLUG}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors"
        >
          Install on GitHub
        </a>
        <p className="text-xs text-gray-600 mt-3">
          Free for public repos. Works with private repos too.
        </p>
      </div>
    </main>
  );
}
