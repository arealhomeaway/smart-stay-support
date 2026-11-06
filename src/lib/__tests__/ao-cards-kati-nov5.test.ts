import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { describe, expect, it } from "bun:test";
import { cardFilesByReview, type OwnerOnboardingFile } from "../owner-onboarding.server";

const D = "docs/pending/ao-cards-kati-nov5";
const read = (f: string) => readFileSync(`${D}/${f}`, "utf8");
const t01 = read("01_standard_template.sql");
const t02 = read("02_card_library.sql");
const block = (code: string) => {
  const start = t02.indexOf(`-- ${code} `);
  return t02.slice(start, t02.indexOf("END $do$;", start));
};
const FLOOR = "5c1f0a52-7d4e-4b8a-9a61-2f3c8e0d1a26";
const FURN = "5c1f0a52-7d4e-4b8a-9a61-2f3c8e0d1a58";

describe("staged package integrity", () => {
  it("every file matches SHA256SUMS", () => {
    for (const line of read("SHA256SUMS").trim().split("\n")) {
      const [sum, name] = line.split(/\s+/);
      expect(createHash("sha256").update(readFileSync(`${D}/${name}`)).digest("hex")).toBe(sum);
    }
  });
  it("has no transaction lines, no em dashes and an undo for each step", () => {
    for (const f of ["01_standard_template.sql", "02_card_library.sql", "03_release_new_cards.sql"]) {
      const s = read(f);
      expect(s).not.toMatch(/^\s*(BEGIN|COMMIT);/m);
      expect(/[\u2014\u2013]/.test(s)).toBe(false);
      expect(read(`undo/${f.replace(/^(\d+)_/, "$1_undo_")}`).length).toBeGreaterThan(100);
    }
  });
});

describe("Standard template", () => {
  it("adds Upload the floor plans for the lead designer before A26's step, with lead designer review", () => {
    expect(/'Upload the floor plans', 'Lead Designer', 'lead_designer', 385/.test(t01)).toBe(true);
    expect(new RegExp(`'${FLOOR}', ARRAY\\['lead_designer'\\]`).test(t01)).toBe(true);
  });
  it("upload of furnishing files carries the Accounting invoice request and retires the separate step", () => {
    expect(t01).toContain("Send the invoice request to Accounting to prepare the initial invoices");
    expect(/is_active = false WHERE id = '3505c129/.test(t01)).toBe(true);
  });
  it("guest instructions become card-only and nothing touches homes on version 1", () => {
    expect(/is_active = false WHERE id = 'cbb23216/.test(t01)).toBe(true);
    expect(/onboarding_projects/.test(t01)).toBe(false);
    expect(t01).toContain("version 1; nothing applied");
  });
});

describe("Active Owner cards", () => {
  it("every edit is versioned with history and checked against the captured version", () => {
    for (const code of ["A15", "A26", "A31", "A35", "A41", "A56", "A57", "P03", "P04", "P14", "P15"]) {
      const b = block(code);
      expect(/version = version \+ 1/.test(b)).toBe(true);
      expect(/AND version = \d+ RETURNING/.test(b)).toBe(true);
      expect(b).toContain("ao_library_card_history");
    }
    expect(/\bN10\b/.test(t02)).toBe(false);
    expect(/ao_home_plan_cards SET/.test(t02)).toBe(false);
  });
  it("A15 stays Draft and A41 goes to Draft with the replacement note", () => {
    expect(block("A15")).toContain("status = $t$draft$t$");
    expect(block("A41")).toContain("Replaced by Review your furnishing breakdown and payment schedule until revised.");
  });
  it("A26 unlocks from the floor plan upload and A58 from the furnishing upload", () => {
    expect(block("A26")).toContain(FLOOR);
    expect(block("A58")).toContain(FURN);
    expect(block("A58")).toContain("Review your furnishing breakdown and payment schedule");
    expect(/'draft', 1/.test(block("A58"))).toBe(true);
  });
  it("card wording follows Kati's review", () => {
    expect(block("A31")).toContain("same handoff meeting");
    expect(block("A35")).toContain("monthly owner statement you already receive");
    expect(/stage_window = \$t\$operations\$t\$/.test(block("A56"))).toBe(true);
    expect(block("A57")).toContain("ec1afa4b-bf49-4d4b-91cf-2f5546fcfa49");
    for (const c of ["P03", "P04"]) expect(block(c)).toContain("approved standards list");
    for (const c of ["P14", "P15"]) expect(block(c)).toContain("Marketing photos link");
    expect(t02).toContain("ADD COLUMN marketing_photos_link text");
  });
  it("P19 and P20 stay card-only", () => {
    expect(/card_code IN \('P19','P20'\) AND status = 'suggested'/.test(t02)).toBe(true);
  });
});

describe("card files from the linked step", () => {
  const f: OwnerOnboardingFile = { id: "d1", title: "Floor plan", filename: "fp.pdf", mimeType: null, sizeBytes: 1, kind: "document" };
  const files = new Map([["t1", [f]]]);
  it("shows shared step files on an unlocked card", () => {
    expect(cardFilesByReview([{ id: "r1", status: "awaiting_owner", onboarding_task_id: "t1" }], files)).toEqual({ r1: [f] });
  });
  it("shows nothing while the card still waits on ARHA", () => {
    expect(cardFilesByReview([{ id: "r1", status: "prepared", onboarding_task_id: "t1" }], files)).toEqual({});
  });
});
