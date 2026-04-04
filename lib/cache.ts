/**
 * cache.ts — Upstash Redis Wrapper
 *
 * RULES (enforced by CLAUDE.md):
 *  - Uses getOrFetch pattern with typed returns
 *  - Cache keys: dep:{ecosystem}:{package_name}:{major_version}
 *  - Never cache error states or degraded results
 *  - Always return cached: boolean
 *  - No business logic — pure Redis abstraction
 */

import { Redis } from "@upstash/redis";
import type { Ecosystem } from "@/types";

// ─── Redis Client ────────────────────────────────────────────────────────────

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL ?? "",
  token: process.env.UPSTASH_REDIS_REST_TOKEN ?? "",
});

// ─── Cache Key Builder ──────────────────────────────────────────────────────

export function buildCacheKey(
  ecosystem: Ecosystem,
  name: string,
  version: string
): string {
  const majorVersion = version.split(".")[0] || "0";
  // v12: zero mock data - real signals only
  return `v12:dep:${ecosystem}:${name}:${majorVersion}`;
}

// ─── Dynamic TTL by Popularity ──────────────────────────────────────────────

export function getDynamicTTL(weeklyDownloads: number): number {
  if (weeklyDownloads > 1_000_000) return 72 * 3600;  // 72 hours
  if (weeklyDownloads > 100_000) return 48 * 3600;    // 48 hours
  if (weeklyDownloads > 10_000) return 24 * 3600;     // 24 hours
  return 12 * 3600;                                    // 12 hours
}

// ─── getOrFetch — Core Caching Pattern ──────────────────────────────────────

export async function getOrFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number
): Promise<{ data: T; cached: boolean }> {
  const cached = await redis.get(key);
  if (cached !== null && cached !== undefined) {
    return { data: cached as T, cached: true };
  }

  const data = await fetcher();
  try {
    await redis.set(key, JSON.stringify(data), { ex: ttlSeconds });
  } catch {
    // Cache write failure is non-fatal — data still returned
  }
  return { data, cached: false };
}

// ─── Direct Cache Access ─────────────────────────────────────────────────────
// Exported so fetcher.ts can do conditional writes (never cache degraded results)

export { redis };
