/**
 * GET /api/badge?ecosystem=npm&package=react
 *
 * Returns an SVG badge showing the health score for a package.
 * Cached for 1 hour via Cache-Control headers.
 *
 * Usage in README:
 *   ![Health](https://dependency-obituary.orelsec.com/api/badge?ecosystem=npm&package=react)
 */

import { NextResponse } from "next/server";
import type { Ecosystem } from "@/types";
import { fetchBatched } from "@/lib/fetcher";

const VALID_ECOSYSTEMS = new Set<string>(["npm", "pypi", "cargo", "go", "rubygems"]);

function scoreToColor(score: number | null): string {
  if (score === null) return "#9ca3af"; // gray
  if (score >= 80) return "#22c55e"; // green
  if (score >= 60) return "#3b82f6"; // blue
  if (score >= 40) return "#eab308"; // yellow
  if (score >= 20) return "#f97316"; // orange
  return "#ef4444"; // red
}

function scoreToLabel(score: number | null): string {
  if (score === null) return "unknown";
  return String(score);
}

function buildSvg(
  packageName: string,
  score: number | null,
  riskLevel: string
): string {
  const color = scoreToColor(score);
  const label = `health: ${scoreToLabel(score)}`;
  const leftText = packageName.length > 24 ? packageName.slice(0, 22) + ".." : packageName;
  const leftWidth = leftText.length * 7 + 12;
  const rightWidth = label.length * 6.5 + 12;
  const totalWidth = leftWidth + rightWidth;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="20" role="img" aria-label="${packageName}: ${label}">
  <title>${packageName}: ${label} (${riskLevel})</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r">
    <rect width="${totalWidth}" height="20" rx="3" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#r)">
    <rect width="${leftWidth}" height="20" fill="#555"/>
    <rect x="${leftWidth}" width="${rightWidth}" height="20" fill="${color}"/>
    <rect width="${totalWidth}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="11">
    <text x="${leftWidth / 2}" y="14" fill="#010101" fill-opacity=".3">${escapeXml(leftText)}</text>
    <text x="${leftWidth / 2}" y="13">${escapeXml(leftText)}</text>
    <text x="${leftWidth + rightWidth / 2}" y="14" fill="#010101" fill-opacity=".3">${escapeXml(label)}</text>
    <text x="${leftWidth + rightWidth / 2}" y="13">${escapeXml(label)}</text>
  </g>
</svg>`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const ecosystem = searchParams.get("ecosystem") || "npm";
  const packageName = searchParams.get("package");

  if (!packageName) {
    return new NextResponse(
      buildSvg("error", null, "unknown"),
      {
        status: 400,
        headers: { "Content-Type": "image/svg+xml", "Cache-Control": "no-cache" },
      }
    );
  }

  if (!VALID_ECOSYSTEMS.has(ecosystem)) {
    return new NextResponse(
      buildSvg(packageName, null, "unknown"),
      {
        status: 400,
        headers: { "Content-Type": "image/svg+xml", "Cache-Control": "no-cache" },
      }
    );
  }

  try {
    const results = await fetchBatched(
      [{ name: packageName, version: "0.0.0" }],
      ecosystem as Ecosystem,
      1,
      0
    );

    const result = results[0];
    const svg = buildSvg(
      packageName,
      result?.health_score ?? null,
      result?.risk_level ?? "unknown"
    );

    return new NextResponse(svg, {
      status: 200,
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    });
  } catch {
    return new NextResponse(
      buildSvg(packageName, null, "unknown"),
      {
        status: 200,
        headers: {
          "Content-Type": "image/svg+xml",
          "Cache-Control": "public, max-age=300",
        },
      }
    );
  }
}
