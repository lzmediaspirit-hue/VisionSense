import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { strings } from "./strings";

// Punitive words banned from ALL user-facing copy (product philosophy, T5).
// "error" is allowed only in dev-only messages (thrown Errors, console), which
// this suite scopes out by only scanning the copy module + JSX text nodes.
const BANNED = [
  "fail",
  "failure",
  "wrong",
  "should",
  "bad",
  "streak",
  "overdue",
  "error",
];
const BANNED_RE = new RegExp(`\\b(${BANNED.join("|")})\\b`, "i");

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, ".."); // src/

/** Recursively collect files under a dir matching the given extensions. */
function collect(dir: string, exts: string[]): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...collect(full, exts));
    } else if (exts.includes(extname(full))) {
      out.push(full);
    }
  }
  return out;
}

/** Flatten every string leaf out of the strings object. */
function flattenStrings(obj: unknown, acc: string[] = []): string[] {
  if (typeof obj === "string") {
    acc.push(obj);
  } else if (obj && typeof obj === "object") {
    for (const v of Object.values(obj)) flattenStrings(v, acc);
  }
  return acc;
}

describe("copy: no banned words in the strings module", () => {
  const leaves = flattenStrings(strings);

  it("scans a non-trivial number of strings", () => {
    expect(leaves.length).toBeGreaterThan(20);
  });

  for (const leaf of flattenStrings(strings)) {
    const match = leaf.match(BANNED_RE);
    it(`ok: ${JSON.stringify(leaf.slice(0, 48))}`, () => {
      expect(
        match,
        match ? `contains banned word "${match[0]}"` : ""
      ).toBeNull();
    });
  }
});

describe("copy: components centralize UI text (no hardcoded copy)", () => {
  // Strip comments and {expression} content, then look for multi-word text
  // nodes between JSX tags — a strong signal of hardcoded user-facing copy
  // that should instead come from the strings module.
  const files = [
    ...collect(join(SRC, "components"), [".tsx"]),
    ...collect(join(SRC, "screens"), [".tsx"]),
  ];

  it("finds component files to scan", () => {
    expect(files.length).toBeGreaterThan(3);
  });

  for (const file of files) {
    it(`no hardcoded UI text in ${file.slice(SRC.length + 1)}`, () => {
      let code = readFileSync(file, "utf8");
      // Remove block and line comments.
      code = code.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
      // Remove {...expression...} content (iterate for shallow nesting).
      for (let i = 0; i < 6; i++) {
        code = code.replace(/\{[^{}]*\}/g, " ");
      }
      // JSX text nodes: content between a `>` and the next `<`. Note that TS
      // generics (`Foo<Bar>`) and comparison operators also produce `>...<`
      // fragments, so we additionally require the candidate to read as natural
      // language: multi-word letters AND free of code punctuation.
      const textNodes = code.match(/>([^<>]+)</g) ?? [];
      const CODE_CHARS = /[=(){}[\]/\\;:`$|&*+]/;
      // TS/JS keywords betray a code fragment captured across a `>` from a
      // generic type argument, not real JSX copy.
      const CODE_KEYWORDS =
        /\b(export|function|const|let|var|return|import|interface|type|class|extends|implements|from|default|typeof|keyof|readonly|namespace|enum)\b/;
      const offenders = textNodes
        .map((t) => t.slice(1, -1).trim())
        .filter(
          (t) =>
            /[A-Za-z]{2,}\s+[A-Za-z]{2,}/.test(t) &&
            !CODE_CHARS.test(t) &&
            !CODE_KEYWORDS.test(t)
        );
      expect(
        offenders,
        `hardcoded UI text found (move to src/copy/strings.ts): ${JSON.stringify(
          offenders
        )}`
      ).toEqual([]);
    });
  }
});
