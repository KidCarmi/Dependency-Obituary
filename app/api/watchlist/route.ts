/**
 * /api/watchlist — CRUD for saved package lists
 *
 * GET:    List user's watchlist entries
 * POST:   Save a new watchlist entry
 * DELETE:  Remove a watchlist entry by id
 *
 * All endpoints require authentication.
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { redis } from "@/lib/cache";
import type { WatchlistEntry, Package, Ecosystem } from "@/types";

function watchlistKey(githubId: number): string {
  return `user:${githubId}:watchlist`;
}

async function getGithubId(): Promise<number | null> {
  const session = await auth();
  if (!session?.user) return null;
  return (session.user as unknown as Record<string, unknown>).githubId as number ?? null;
}

// ─── GET — List watchlist ──────────────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  const githubId = await getGithubId();
  if (!githubId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const raw = await redis.get(watchlistKey(githubId));
  const entries: WatchlistEntry[] = raw ? (raw as WatchlistEntry[]) : [];

  return NextResponse.json({ entries });
}

// ─── POST — Add to watchlist ───────────────────────────────────────────────

interface AddRequest {
  name: string;
  ecosystem: Ecosystem;
  filename: string;
  packages: Package[];
}

function isValidAddRequest(body: unknown): body is AddRequest {
  if (typeof body !== "object" || body === null) return false;
  const obj = body as Record<string, unknown>;
  return (
    typeof obj.name === "string" &&
    typeof obj.ecosystem === "string" &&
    typeof obj.filename === "string" &&
    Array.isArray(obj.packages) &&
    obj.packages.length > 0
  );
}

export async function POST(request: Request): Promise<NextResponse> {
  const githubId = await getGithubId();
  if (!githubId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body: unknown = await request.json();
  if (!isValidAddRequest(body)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const key = watchlistKey(githubId);
  const raw = await redis.get(key);
  const entries: WatchlistEntry[] = raw ? (raw as WatchlistEntry[]) : [];

  // Max 20 watchlist entries per user
  if (entries.length >= 20) {
    return NextResponse.json(
      { error: "Watchlist limit reached (20 projects)" },
      { status: 400 }
    );
  }

  const newEntry: WatchlistEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: body.name,
    ecosystem: body.ecosystem,
    filename: body.filename,
    packages: body.packages.slice(0, 500),
    created_at: new Date().toISOString(),
  };

  entries.push(newEntry);
  await redis.set(key, JSON.stringify(entries));

  return NextResponse.json({ entry: newEntry }, { status: 201 });
}

// ─── DELETE — Remove from watchlist ────────────────────────────────────────

export async function DELETE(request: Request): Promise<NextResponse> {
  const githubId = await getGithubId();
  if (!githubId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const key = watchlistKey(githubId);
  const raw = await redis.get(key);
  const entries: WatchlistEntry[] = raw ? (raw as WatchlistEntry[]) : [];

  const filtered = entries.filter((e) => e.id !== id);
  if (filtered.length === entries.length) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await redis.set(key, JSON.stringify(filtered));
  return NextResponse.json({ success: true });
}
