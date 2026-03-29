/**
 * GET /api/cron/refresh-popular
 *
 * Called nightly by Vercel Cron to warm cache for popular packages.
 */

import { NextResponse } from "next/server";
import { fetchBatched } from "@/lib/fetcher";
import type { Package } from "@/types";
import popularPackages from "@/data/popular-packages.json";

export async function GET(request: Request): Promise<NextResponse> {
  // Verify Vercel Cron secret
  const authHeader = request.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();

  try {
    const packages: Package[] = (
      popularPackages as Array<{ name: string; version: string }>
    ).map((p) => ({
      name: p.name,
      version: p.version,
    }));

    const results = await fetchBatched(packages, "npm", 3, 500);

    const refreshed = results.filter(
      (r) => r.data_confidence !== "unavailable"
    ).length;
    const failed = results.filter(
      (r) => r.data_confidence === "unavailable"
    ).length;

    return NextResponse.json({
      refreshed,
      failed,
      total: packages.length,
      duration_ms: Date.now() - startTime,
    });
  } catch {
    return NextResponse.json({
      refreshed: 0,
      failed: 0,
      total: 0,
      duration_ms: Date.now() - startTime,
      error: "Refresh failed",
    });
  }
}
