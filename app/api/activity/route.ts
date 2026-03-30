/**
 * GET /api/activity — Fetch PR activity feed
 *
 * Returns recent PR analysis events from the GitHub App.
 * Scans all feed:* keys in Redis to find events across installations.
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

export async function GET(): Promise<NextResponse> {
  const allEvents: ActivityEvent[] = [];

  // Scan for all feed:* keys
  let cursor = 0;
  do {
    const [nextCursor, keys] = await redis.scan(cursor, {
      match: "feed:*",
      count: 50,
    });
    cursor = typeof nextCursor === "string" ? parseInt(nextCursor, 10) : nextCursor;

    for (const key of keys) {
      const items = await redis.lrange(key as string, 0, 49);
      for (const item of items) {
        if (typeof item === "string") {
          allEvents.push(JSON.parse(item) as ActivityEvent);
        } else {
          allEvents.push(item as ActivityEvent);
        }
      }
    }
  } while (cursor !== 0);

  // Sort by timestamp descending
  allEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return NextResponse.json({ events: allEvents.slice(0, 50) });
}
