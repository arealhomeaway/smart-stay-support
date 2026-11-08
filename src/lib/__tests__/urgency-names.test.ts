import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { PRIORITIES, URGENCY_NAMES, priorityMeta } from "../tickets";

/** Every app source file a screen, alert, email or filter can read text from. */
function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === "__tests__" || name === "node_modules") continue;
      out.push(...sourceFiles(p));
    } else if (/\.(ts|tsx)$/.test(name) && !name.endsWith(".test.ts") && name !== "types.ts" && name !== "routeTree.gen.ts") {
      out.push(p);
    }
  }
  return out;
}

// The retired urgency names, in any spacing or dash.
const OLD_NAMES = [
  /P1\s*[—–-]?\s*Critical/i,
  /P2\s*[—–-]?\s*Time[\s-]?sensitive/i,
  /time[\s-]?sensitive\s+P2/i,
  /P3\s*[—–-]?\s*Standard/i,
  /Critical \(immediate action\)/i,
  /Standard \(planned work\)/i,
];

describe("urgency names: Right now, Today, Routine", () => {
  it("one shared place names each urgency, codes stay internal", () => {
    expect(URGENCY_NAMES).toEqual({ p1: "Right now", p2: "Today", p3: "Routine" });
    expect(PRIORITIES.map((p) => [p.value, p.name, p.label])).toEqual([
      ["p1", "Right now", "Right now (P1)"],
      ["p2", "Today", "Today (P2)"],
      ["p3", "Routine", "Routine (P3)"],
    ]);
    expect(priorityMeta("p2").name).toBe("Today");
  });

  it("no app text uses the old urgency names", () => {
    const hits: string[] = [];
    for (const f of sourceFiles("src")) {
      const text = readFileSync(f, "utf8");
      for (const re of OLD_NAMES) if (re.test(text)) hits.push(`${f}: ${re}`);
    }
    expect(hits).toEqual([]);
  });
});
