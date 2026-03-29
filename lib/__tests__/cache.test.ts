import { describe, it, expect } from "vitest";
import { buildCacheKey, getDynamicTTL } from "@/lib/cache";

// ─── buildCacheKey ──────────────────────────────────────────────────────────

describe("buildCacheKey", () => {
  it("builds correct key for npm package", () => {
    expect(buildCacheKey("npm", "react", "18.2.0")).toBe("dep:npm:react:18");
  });

  it("builds correct key for pypi package", () => {
    expect(buildCacheKey("pypi", "requests", "2.28.0")).toBe(
      "dep:pypi:requests:2"
    );
  });

  it("handles version with no dots", () => {
    expect(buildCacheKey("npm", "left-pad", "1")).toBe("dep:npm:left-pad:1");
  });

  it("handles empty version string", () => {
    expect(buildCacheKey("npm", "foo", "")).toBe("dep:npm:foo:0");
  });
});

// ─── getDynamicTTL ──────────────────────────────────────────────────────────

describe("getDynamicTTL", () => {
  it("returns 72h for >1M weekly downloads", () => {
    expect(getDynamicTTL(2_000_000)).toBe(72 * 3600);
  });

  it("returns 48h for 100k-1M weekly downloads", () => {
    expect(getDynamicTTL(500_000)).toBe(48 * 3600);
  });

  it("returns 24h for 10k-100k weekly downloads", () => {
    expect(getDynamicTTL(50_000)).toBe(24 * 3600);
  });

  it("returns 12h for <10k weekly downloads", () => {
    expect(getDynamicTTL(5_000)).toBe(12 * 3600);
  });

  it("returns 12h for 0 downloads", () => {
    expect(getDynamicTTL(0)).toBe(12 * 3600);
  });

  it("returns 72h for exactly 1M+1 downloads", () => {
    expect(getDynamicTTL(1_000_001)).toBe(72 * 3600);
  });

  it("returns 48h for exactly 1M downloads", () => {
    // 1M is NOT > 1M, so falls to next tier
    expect(getDynamicTTL(1_000_000)).toBe(48 * 3600);
  });
});
