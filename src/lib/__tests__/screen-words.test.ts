import { describe, expect, it } from "bun:test";
import ts from "typescript";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Words and names sweep (fix batch 3). Reads every piece of text a person can see in the app
 * source: strings, template text and JSX text in components, routes, templates, seed text,
 * alerts and error messages. A banned word or a staff first name fails the test.
 *
 * Allowed on purpose (documented exceptions):
 * - Code comments: never shown, so they are not read at all.
 * - Test fixtures: the __tests__ folders and *.test.ts files are not read.
 * - Database identifiers and internal column names: a string with no spaces in lower case,
 *   snake_case or camelCase (for example "seat", "median_ack", "invoice_sample") is an
 *   identifier, not screen text. Import paths and type-only strings are skipped too.
 * - Imported Notion history: it lives only in the database and keeps its original names.
 *   It is not in the app source, so nothing here needs an exception for it.
 * - The generated database types (src/integrations) and generated route tree.
 * - FROZEN below: text that needs its own approval to change. Its count may only go down.
 */
const ROOT = join(import.meta.dir, "..", "..");

const WORDS: Record<string, RegExp> = {
  seat: /\bseats?\b/i,
  median: /\bmedians?\b/i,
  threshold: /\bthresholds?\b/i,
  sample: /\bsamples?\b/i,
  // Where a rule came from. Plain "proposed amount/remedy/value/date" for something
  // waiting on a decision is ordinary language and stays allowed.
  proposal:
    /\bproposals?\b|\bsigned off\b|\bproposed (standard|standards|wording|requirements?|removal|rules?|policy)\b|\bProposed\.(\s|$)|\bproposed (by|from)\b/i,
};
const NAMES = ["Emily", "Micah", "Kati", "James", "Josh", "Avy", "Nelson", "Qym", "Mike", "Romeo", "Roms"];
for (const n of NAMES) WORDS[n] = new RegExp(`\\b${n}\\b`);

/**
 * Text that stays until it is approved separately. Each entry is the exact number of hits
 * today; a new hit fails, a removed hit means the number here should be lowered.
 */
const FROZEN: Record<string, Record<string, number>> = {
  // Protected onboarding template Task text (Full Furnishing plan). Changing it needs its own
  // approval; the matching database template rows are not touched either.
  "src/lib/onboarding-template.ts": { James: 2, Josh: 3, Kati: 4, Micah: 3, sample: 3 },
  // Recovery policy version stamp. It is saved on every refund and credit record, so
  // renaming it would split their history.
  "src/lib/recovery-policy.ts": { threshold: 1 },
};

function files(dir: string, out: string[] = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (name === "__tests__" || name === "integrations") continue;
      files(path, out);
    } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) && name !== "routeTree.gen.ts") {
      out.push(path);
    }
  }
  return out;
}

const isIdentifier = (s: string) =>
  /^[a-z0-9_.:\-/]+$/.test(s) || /^[a-z]+[A-Z][A-Za-z0-9]*$/.test(s);

type Hit = { file: string; line: number; word: string; text: string };

function scan(): Hit[] {
  const hits: Hit[] = [];
  for (const path of files(ROOT)) {
    const file = relative(join(ROOT, ".."), path);
    const sf = ts.createSourceFile(
      path,
      readFileSync(path, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      path.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    const visit = (node: ts.Node) => {
      let text: string | null = null;
      if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
        const p = node.parent;
        const skip =
          ts.isImportDeclaration(p) ||
          ts.isExportDeclaration(p) ||
          ts.isLiteralTypeNode(p) ||
          (ts.isCallExpression(p) && p.expression.kind === ts.SyntaxKind.ImportKeyword);
        if (!skip) text = node.text;
      } else if (ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
        text = node.text;
      } else if (ts.isJsxText(node)) {
        text = node.text;
      }
      if (text && !isIdentifier(text.trim())) {
        for (const [word, re] of Object.entries(WORDS)) {
          if (re.test(text)) {
            hits.push({
              file,
              line: sf.getLineAndCharacterOfPosition(node.getStart()).line + 1,
              word,
              text: text.replace(/\s+/g, " ").trim().slice(0, 120),
            });
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  return hits;
}

describe("screen words and names", () => {
  const hits = scan();

  it("no banned word or staff name appears in screen text outside the frozen list", () => {
    const loose = hits.filter((h) => !FROZEN[h.file]?.[h.word]);
    expect(loose.map((h) => `${h.file}:${h.line} [${h.word}] ${h.text}`)).toEqual([]);
  });

  it("frozen text never grows", () => {
    for (const [file, words] of Object.entries(FROZEN)) {
      for (const [word, max] of Object.entries(words)) {
        const n = hits.filter((h) => h.file === file && h.word === word).length;
        expect({ file, word, n }).toEqual({ file, word, n: max });
      }
    }
  });

  it("the scanner itself catches each word and name", () => {
    const samples = [
      "Seat holder",
      "Median close",
      "the owner threshold",
      "Sample guest",
      "Proposed. Waiting.",
      "a proposal only",
      "have not signed off",
      ...NAMES.map((n) => `Ask ${n} first`),
    ];
    for (const s of samples) expect(Object.values(WORDS).some((re) => re.test(s))).toBe(true);
    for (const ok of ["Proposed amount", "Typical close", "Team and shift", "seatHolder", "median_ack"]) {
      expect(isIdentifier(ok) || !Object.values(WORDS).some((re) => re.test(ok))).toBe(true);
    }
  });
});
