/**
 * POST /api/analyze
 *
 * Orchestrates fetcher + scorer. Never returns 500.
 */

import { NextResponse } from "next/server";
import type {
  AnalyzeRequest,
  AnalyzeResponse,
  Ecosystem,
  Package,
} from "@/types";
import { fetchBatched } from "@/lib/fetcher";

const MAX_PACKAGES = 500;

function isValidEcosystem(value: unknown): value is Ecosystem {
  return (
    value === "npm" ||
    value === "pypi" ||
    value === "cargo" ||
    value === "go" ||
    value === "rubygems"
  );
}

function isValidPackage(value: unknown): value is Package {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return typeof obj.name === "string" && typeof obj.version === "string";
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body: unknown = await request.json();

    if (typeof body !== "object" || body === null) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    const { ecosystem, packages } = body as AnalyzeRequest;

    if (!isValidEcosystem(ecosystem)) {
      return NextResponse.json(
        { error: 'ecosystem must be "npm" or "pypi"' },
        { status: 400 }
      );
    }

    if (!Array.isArray(packages) || packages.length === 0) {
      return NextResponse.json(
        { error: "packages must be a non-empty array" },
        { status: 400 }
      );
    }

    if (!packages.every(isValidPackage)) {
      return NextResponse.json(
        { error: "Each package must have name and version strings" },
        { status: 400 }
      );
    }

    const trimmedPackages = packages.slice(0, MAX_PACKAGES);
    const results = await fetchBatched(trimmedPackages, ecosystem);

    const cacheHits = results.filter(
      (r) => r.data_confidence !== "unavailable"
    ).length;
    const degradedCount = results.filter(
      (r) => r.data_confidence === "unavailable"
    ).length;

    const response: AnalyzeResponse = {
      meta: {
        analyzed_at: new Date().toISOString(),
        cache_hit_rate:
          trimmedPackages.length > 0
            ? cacheHits / trimmedPackages.length
            : 0,
        degraded_count: degradedCount,
        github_rate_limit: {
          remaining: 0,
          used: 0,
          resetAt: "",
        },
      },
      results,
    };

    return NextResponse.json(response);
  } catch {
    // Never return 500 — return empty results with error context
    return NextResponse.json<AnalyzeResponse>({
      meta: {
        analyzed_at: new Date().toISOString(),
        cache_hit_rate: 0,
        degraded_count: 0,
        github_rate_limit: { remaining: 0, used: 0, resetAt: "" },
      },
      results: [],
    });
  }
}
