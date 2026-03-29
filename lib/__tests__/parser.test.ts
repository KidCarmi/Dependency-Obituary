import { describe, it, expect } from "vitest";
import {
  parsePackageJson,
  parseRequirementsTxt,
  parseCargoToml,
  parseGoMod,
  parseGemfile,
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

// ─── parseCargoToml ─────────────────────────────────────────────────────────

describe("parseCargoToml", () => {
  it("parses simple dependencies", () => {
    const content = `[dependencies]
serde = "1.0"
tokio = "1.34"
`;
    const result = parseCargoToml(content);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ name: "serde", version: "1.0" });
    expect(result[1]).toEqual({ name: "tokio", version: "1.34" });
  });

  it("parses inline table dependencies", () => {
    const content = `[dependencies]
tokio = { version = "1.34", features = ["full"] }
serde = { version = "1.0", features = ["derive"] }
`;
    const result = parseCargoToml(content);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ name: "tokio", version: "1.34" });
    expect(result[1]).toEqual({ name: "serde", version: "1.0" });
  });

  it("parses dev-dependencies section", () => {
    const content = `[dependencies]
serde = "1.0"

[dev-dependencies]
criterion = "0.5"
`;
    const result = parseCargoToml(content);
    expect(result).toHaveLength(2);
    expect(result.find((p) => p.name === "criterion")).toBeDefined();
  });

  it("ignores non-dependency sections", () => {
    const content = `[package]
name = "my-crate"
version = "0.1.0"

[dependencies]
serde = "1.0"
`;
    const result = parseCargoToml(content);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("serde");
  });

  it("strips version prefixes", () => {
    const content = `[dependencies]
serde = "^1.0"
tokio = "~1.34"
`;
    const result = parseCargoToml(content);
    expect(result[0].version).toBe("1.0");
    expect(result[1].version).toBe("1.34");
  });

  it("returns empty array for empty content", () => {
    expect(parseCargoToml("")).toEqual([]);
  });

  it("handles comments", () => {
    const content = `[dependencies]
# This is a comment
serde = "1.0"
`;
    const result = parseCargoToml(content);
    expect(result).toHaveLength(1);
  });
});

// ─── parseGoMod ─────────────────────────────────────────────────────────────

describe("parseGoMod", () => {
  it("parses require block", () => {
    const content = `module github.com/example/project

go 1.21

require (
\tgithub.com/gin-gonic/gin v1.9.1
\tgolang.org/x/crypto v0.14.0
)
`;
    const result = parseGoMod(content);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ name: "github.com/gin-gonic/gin", version: "1.9.1" });
    expect(result[1]).toEqual({ name: "golang.org/x/crypto", version: "0.14.0" });
  });

  it("parses single-line require", () => {
    const content = `module example.com/foo

require github.com/stretchr/testify v1.8.4
`;
    const result = parseGoMod(content);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ name: "github.com/stretchr/testify", version: "1.8.4" });
  });

  it("ignores comments", () => {
    const content = `require (
\t// indirect
\tgithub.com/foo/bar v1.0.0
)
`;
    const result = parseGoMod(content);
    expect(result).toHaveLength(1);
  });

  it("handles pre-release versions", () => {
    const content = `require (
\tgithub.com/foo/bar v0.0.0-20231027123456-abcdef123456
)
`;
    const result = parseGoMod(content);
    expect(result).toHaveLength(1);
    expect(result[0].version).toBe("0.0.0-20231027123456-abcdef123456");
  });

  it("returns empty array for empty content", () => {
    expect(parseGoMod("")).toEqual([]);
  });
});

// ─── parseGemfile ───────────────────────────────────────────────────────────

describe("parseGemfile", () => {
  it("parses gems with versions", () => {
    const content = `source 'https://rubygems.org'

gem 'rails', '~> 7.0'
gem 'pg', '>= 1.1'
gem 'puma', '~> 5.0'
`;
    const result = parseGemfile(content);
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ name: "rails", version: "7.0" });
    expect(result[1]).toEqual({ name: "pg", version: "1.1" });
    expect(result[2]).toEqual({ name: "puma", version: "5.0" });
  });

  it("parses gems without versions", () => {
    const content = `gem 'debug'
gem 'web-console'
`;
    const result = parseGemfile(content);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ name: "debug", version: "0.0.0" });
    expect(result[1]).toEqual({ name: "web-console", version: "0.0.0" });
  });

  it("handles double-quoted gems", () => {
    const content = `gem "rails", "~> 7.0"`;
    const result = parseGemfile(content);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("rails");
  });

  it("ignores comments", () => {
    const content = `# Main framework
gem 'rails', '~> 7.0'
# Database
`;
    const result = parseGemfile(content);
    expect(result).toHaveLength(1);
  });

  it("returns empty array for empty content", () => {
    expect(parseGemfile("")).toEqual([]);
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

  it("detects Cargo.toml by filename", () => {
    const content = `[dependencies]\nserde = "1.0"`;
    const result = parseFile("Cargo.toml", content);
    expect(result.ecosystem).toBe("cargo");
    expect(result.packages).toHaveLength(1);
  });

  it("detects go.mod by filename", () => {
    const content = `module example.com/foo\n\nrequire github.com/gin-gonic/gin v1.9.1`;
    const result = parseFile("go.mod", content);
    expect(result.ecosystem).toBe("go");
    expect(result.packages).toHaveLength(1);
  });

  it("detects Gemfile by filename", () => {
    const content = `gem 'rails', '~> 7.0'`;
    const result = parseFile("Gemfile", content);
    expect(result.ecosystem).toBe("rubygems");
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
