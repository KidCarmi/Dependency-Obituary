/**
 * /api/share — Save and load shareable reports
 *
 * POST: Save analysis results, return a share ID
 * GET:  Load saved results by ID
 *
 * Reports expire after 30 days. No auth required.
 */

import { NextResponse } from "next/server";
import { redis } from "@/lib/cache";
import type { AnalyzeResponse } from "@/types";

const SHARE_TTL = 30 * 24 * 3600; // 30 days
const MAX_RESULTS = 500;

function shareKey(id: string): string {
  return `share:${id}`;
}

function generateId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  for (let i = 0; i < 8; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

// ─── POST — Save report ───────────────────────────────────────────────────

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body: unknown = await request.json();
    if (typeof body !== "object" || body === null) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    const { results, ecosystem, filename } = body as Record<string, unknown>;

    if (!results || !Array.isArray((results as AnalyzeResponse).results)) {
      return NextResponse.json({ error: "Invalid results" }, { status: 400 });
    }

    const data = results as AnalyzeResponse;

    // Limit size
    if (data.results.length > MAX_RESULTS) {
      data.results = data.results.slice(0, MAX_RESULTS);
    }

    const id = generateId();
    const payload = {
      data,
      ecosystem: ecosystem || "npm",
      filename: filename || "unknown",
      created_at: new Date().toISOString(),
    };

    await redis.set(shareKey(id), JSON.stringify(payload), { ex: SHARE_TTL });

    return NextResponse.json({ id });
  } catch {
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}

// ─── GET — Load report ────────────────────────────────────────────────────

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id || !/^[a-z0-9]{8}$/.test(id)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const raw = await redis.get(shareKey(id));
  if (!raw) {
    return NextResponse.json({ error: "Report not found or expired" }, { status: 404 });
  }

  return NextResponse.json(raw);
}
