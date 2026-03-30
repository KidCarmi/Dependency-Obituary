/**
 * GET /api/activity — Fetch PR activity feed
 *
 * Returns recent PR analysis events from the GitHub App.
 * No auth required — events are keyed by installation ID.
 * Query param: installation_id (optional, defaults to "global")
 */

import { NextResponse } from "next/server";
import { redis } from "@/lib/cache";

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

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const installationId = searchParams.get("installation_id") || "global";

  const feedKey = `feed:${installationId}`;
  const raw = await redis.lrange(feedKey, 0, 49);

  const events: ActivityEvent[] = raw.map((item) => {
    if (typeof item === "string") return JSON.parse(item) as ActivityEvent;
    return item as ActivityEvent;
  });

  return NextResponse.json({ events });
}
