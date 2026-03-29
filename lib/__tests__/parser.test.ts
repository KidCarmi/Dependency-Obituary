import { describe, it, expect } from "vitest";
import {
  parsePackageJson,
  parseRequirementsTxt,
  parseFile,
} from "@/lib/parser";

// ─── parsePackageJson ───────────────────────────────────────────────────────

describe("parsePackageJson", () => {
  it("parses valid package.json with dependencies", () => {
    const content = JSON.stringify({
      dependencies: {
        react: "^18.2.0",
        express: "~4.18.2",
      },
    });

    const result = parsePackageJson(content);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ name: "react", version: "18.2.0" });
    expect(result[1]).toEqual({ name: "express", version: "4.18.2" });
  });

  it("parses package.json with both dependencies and devDependencies", () => {
    const content = JSON.stringify({
      dependencies: { react: "^18.0.0" },
      devDependencies: { vitest: "^2.0.0" },
    });

    const result = parsePackageJson(content);
    expect(result).toHaveLength(2);
    expect(result.find((p) => p.name === "react")).toBeDefined();
    expect(result.find((p) => p.name === "vitest")).toBeDefined();
  });

  it("handles package.json with only devDependencies", () => {
    const content = JSON.stringify({
      devDependencies: { typescript: "5.3.0" },
    });

    const result = parsePackageJson(content);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("typescript");
  });

  it("handles monorepo package.json (no deps, has workspaces)", () => {
    const content = JSON.stringify({
      name: "monorepo",
      workspaces: ["packages/*"],
    });

    const result = parsePackageJson(content);
    expect(result).toHaveLength(0);
  });

  it("returns empty array for malformed JSON", () => {
    const result = parsePackageJson("{not valid json");
    expect(result).toEqual([]);
  });

  it("returns empty array for empty string", () => {
    const result = parsePackageJson("");
    expect(result).toEqual([]);
  });

  it("returns empty array for non-object JSON", () => {
    const result = parsePackageJson('"just a string"');
    expect(result).toEqual([]);
  });

  it("returns empty array for null JSON", () => {
    const result = parsePackageJson("null");
    expect(result).toEqual([]);
  });

  it("strips version prefixes", () => {
    const content = JSON.stringify({
      dependencies: {
        a: "^1.0.0",
        b: "~2.0.0",
        c: ">=3.0.0",
        d: "1.0.0",
        e: "*",
      },
    });

    const result = parsePackageJson(content);
    expect(result.find((p) => p.name === "a")?.version).toBe("1.0.0");
    expect(result.find((p) => p.name === "b")?.version).toBe("2.0.0");
    expect(result.find((p) => p.name === "c")?.version).toBe("3.0.0");
    expect(result.find((p) => p.name === "d")?.version).toBe("1.0.0");
    expect(result.find((p) => p.name === "e")?.version).toBe("0.0.0");
  });
});

// ─── parseRequirementsTxt ───────────────────────────────────────────────────

describe("parseRequirementsTxt", () => {
  it("parses valid requirements.txt", () => {
    const content = "requests==2.28.0\nflask>=2.0.0\nnumpy~=1.24.0";

    const result = parseRequirementsTxt(content);
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ name: "requests", version: "2.28.0" });
    expect(result[1]).toEqual({ name: "flask", version: "2.0.0" });
    expect(result[2]).toEqual({ name: "numpy", version: "1.24.0" });
  });

  it("handles comments and blank lines", () => {
    const content = `# This is a comment
requests==2.28.0

# Another comment
flask>=2.0.0
`;

    const result = parseRequirementsTxt(content);
    expect(result).toHaveLength(2);
  });

  it("ignores -r, -e, and flag lines", () => {
    const content = `-r base.txt
-e git+https://github.com/foo/bar.git
--index-url https://pypi.org/simple
requests==2.28.0`;

    const result = parseRequirementsTxt(content);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("requests");
  });

  it("handles packages without version specifiers", () => {
    const content = "requests\nflask";

    const result = parseRequirementsTxt(content);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ name: "requests", version: "0.0.0" });
    expect(result[1]).toEqual({ name: "flask", version: "0.0.0" });
  });

  it("handles extras in brackets", () => {
    const content = "requests[security]==2.28.0";

    const result = parseRequirementsTxt(content);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("requests");
    expect(result[0].version).toBe("2.28.0");
  });

  it("returns empty array for empty string", () => {
    const result = parseRequirementsTxt("");
    expect(result).toEqual([]);
  });
});

// ─── parseFile ──────────────────────────────────────────────────────────────

describe("parseFile", () => {
  it("detects package.json by filename", () => {
    const content = JSON.stringify({
      dependencies: { react: "^18.0.0" },
    });

    const result = parseFile("package.json", content);
    expect(result.ecosystem).toBe("npm");
    expect(result.packages).toHaveLength(1);
  });

  it("detects requirements.txt by filename", () => {
    const result = parseFile("requirements.txt", "requests==2.28.0");
    expect(result.ecosystem).toBe("pypi");
    expect(result.packages).toHaveLength(1);
  });

  it("returns empty packages for unknown file with no content", () => {
    const result = parseFile("unknown.xyz", "");
    expect(result.packages).toHaveLength(0);
  });

  it("auto-detects JSON content", () => {
    const content = JSON.stringify({
      dependencies: { express: "4.0.0" },
    });

    const result = parseFile("deps.json", content);
    expect(result.ecosystem).toBe("npm");
    expect(result.packages).toHaveLength(1);
  });
});
