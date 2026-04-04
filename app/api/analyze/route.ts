/**
 * POST /api/analyze
 *
 * Orchestrates fetcher + scorer. Never returns 500.
 * When a user is signed in, uses their GitHub OAuth token
 * for API calls (5k req/hr per user vs shared token).
 */

import { NextResponse } from "next/server";
import type {
  AnalyzeRequest,
  AnalyzeResponse,
  Ecosystem,
  Package,
} from "@/types";
import { fetchBatched } from "@/lib/fetcher";
import { auth } from "@/lib/auth";

const MAX_PACKAGES = 500;

const VALID_ECOSYSTEMS: ReadonlySet<string> = new Set(["npm", "pypi", "cargo", "go", "rubygems", "packagist", "maven", "pub", "vcpkg"]);

const SAFE_PACKAGE_NAME = /^[a-zA-Z0-9._@/:~\-]+$/;
const MAX_PACKAGE_NAME_LENGTH = 214; // npm max is 214

function isValidEcosystem(value: unknown): value is Ecosystem {
  return typeof value === "string" && VALID_ECOSYSTEMS.has(value);
}

function isValidPackage(value: unknown): value is Package {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  if (typeof obj.name !== "string" || typeof obj.version !== "string") return false;
  if (obj.name.length === 0 || obj.name.length > MAX_PACKAGE_NAME_LENGTH) return false;
  if (!SAFE_PACKAGE_NAME.test(obj.name)) return false;
  return true;
}

interface ValidatedInput {
  ecosystem: Ecosystem;
  packages: Package[];
}

function parseAndValidateBody(body: unknown): ValidatedInput | string {
  if (typeof body !== "object" || body === null) return "Invalid request body";

  const obj = body as Record<string, unknown>;

  if (!isValidEcosystem(obj.ecosystem)) return "Invalid ecosystem";

  if (!Array.isArray(obj.packages) || obj.packages.length === 0) {
    return "packages must be a non-empty array";
  }

  const packages: Package[] = [];
  for (const item of obj.packages) {
    if (!isValidPackage(item)) return "Each package must have a valid name and version";
    packages.push({
      name: String(item.name),
      version: String(item.version),
      isDirect: typeof item.isDirect === "boolean" ? item.isDirect : undefined,
      dependedBy: typeof item.dependedBy === "string" ? item.dependedBy : undefined,
    });
  }

  return { ecosystem: obj.ecosystem as Ecosystem, packages };
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body: unknown = await request.json();
    const parsed = parseAndValidateBody(body);

    if (typeof parsed === "string") {
      return NextResponse.json({ error: parsed }, { status: 400 });
    }

    const { ecosystem, packages: validatedPackages } = parsed;

    // Use the signed-in user's GitHub token if available
    let userGithubToken: string | undefined;
    try {
      const session = await auth();
      if (session) {
        userGithubToken = (session as unknown as Record<string, unknown>).accessToken as string | undefined;
      }
    } catch {
      // Auth not configured or failed — use shared token
    }

    const trimmedPackages = validatedPackages.slice(0, MAX_PACKAGES);
    const results = await fetchBatched(
      trimmedPackages,
      ecosystem,
      5,
      200,
      userGithubToken
    );

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
