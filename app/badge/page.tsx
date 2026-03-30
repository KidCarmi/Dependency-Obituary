"use client";

import { useState, useCallback } from "react";
import type { Ecosystem } from "@/types";

const ECOSYSTEMS: { value: Ecosystem; label: string; placeholder: string }[] = [
  { value: "npm", label: "npm", placeholder: "react" },
  { value: "pypi", label: "PyPI", placeholder: "requests" },
  { value: "cargo", label: "Cargo", placeholder: "serde" },
  { value: "go", label: "Go", placeholder: "github.com/gin-gonic/gin" },
  { value: "rubygems", label: "RubyGems", placeholder: "rails" },
  { value: "packagist", label: "PHP", placeholder: "laravel/framework" },
  { value: "maven", label: "Java", placeholder: "com.google.guava:guava" },
  { value: "pub", label: "Dart", placeholder: "http" },
];

export default function BadgePage(): React.ReactElement {
  const [ecosystem, setEcosystem] = useState<Ecosystem>("npm");
  const [packageName, setPackageName] = useState("");
  const [copied, setCopied] = useState(false);

  const currentEco = ECOSYSTEMS.find((e) => e.value === ecosystem)!;

  const badgeUrl = packageName
    ? `https://dependency-obituary.orelsec.com/api/badge?ecosystem=${ecosystem}&package=${encodeURIComponent(packageName)}`
    : "";

  const markdown = packageName
    ? `![Health Score](${badgeUrl})`
    : "";

  const handleCopy = useCallback(() => {
    if (!markdown) return;
    navigator.clipboard.writeText(markdown).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [markdown]);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="max-w-xl w-full">
        <a
          href="/"
          className="text-sm text-gray-400 hover:text-white transition-colors mb-6 block"
        >
          &larr; Back to analyzer
        </a>

        <h1 className="text-3xl font-bold mb-2">Badge Generator</h1>
        <p className="text-gray-400 mb-8">
          Add health score badges to your README
        </p>

        {/* Ecosystem Selector */}
        <div className="flex gap-2 mb-4">
          {ECOSYSTEMS.map((eco) => (
            <button
              key={eco.value}
              onClick={() => setEcosystem(eco.value)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                ecosystem === eco.value
                  ? "bg-blue-600 text-white"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700"
              }`}
            >
              {eco.label}
            </button>
          ))}
        </div>

        {/* Package Name Input */}
        <input
          type="text"
          value={packageName}
          onChange={(e) => setPackageName(e.target.value)}
          placeholder={currentEco.placeholder}
          className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 mb-6"
        />

        {/* Preview */}
        {packageName && (
          <div className="space-y-4">
            <div>
              <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-2">
                Preview
              </h3>
              <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 flex justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={badgeUrl}
                  alt={`Health score for ${packageName}`}
                  className="h-5"
                />
              </div>
            </div>

            <div>
              <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-2">
                Markdown
              </h3>
              <div className="relative">
                <pre className="bg-gray-900 border border-gray-800 rounded-lg p-4 text-sm text-gray-300 overflow-x-auto">
                  {markdown}
                </pre>
                <button
                  onClick={handleCopy}
                  className="absolute top-2 right-2 px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>

            <div>
              <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-2">
                HTML
              </h3>
              <pre className="bg-gray-900 border border-gray-800 rounded-lg p-4 text-sm text-gray-300 overflow-x-auto">
                {`<img src="${badgeUrl}" alt="Health Score" />`}
              </pre>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
