/**
 * DELETE /api/cache?prefix=dep:npm
 *
 * Flushes cached dependency scores. Requires CACHE_FLUSH_SECRET header
 * to prevent unauthorized cache clearing.
 *
 * Query params:
 *   prefix — optional key prefix to flush (default: "dep:" = all dep scores)
 */

import { NextResponse } from "next/server";
import { redis } from "@/lib/cache";

export async function DELETE(request: Request): Promise<NextResponse> {
  // Simple secret-based auth for cache flush
  const secret = request.headers.get("x-cache-secret");
  const expectedSecret = process.env.CACHE_FLUSH_SECRET;

  if (!expectedSecret || secret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const prefix = searchParams.get("prefix") || "dep:";

  try {
    // Scan and delete matching keys
    let cursor = 0;
    let deleted = 0;

    do {
      const [nextCursor, keys] = await redis.scan(cursor, {
        match: `${prefix}*`,
        count: 100,
      });
      cursor = typeof nextCursor === "string" ? parseInt(nextCursor, 10) : nextCursor;

      if (keys.length > 0) {
        for (const key of keys) {
          await redis.del(key as string);
        }
        deleted += keys.length;
      }
    } while (cursor !== 0);

    return NextResponse.json({ deleted, prefix });
  } catch {
    return NextResponse.json({ error: "Flush failed" }, { status: 500 });
  }
}
