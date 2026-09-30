import { describe, expect, it } from "bun:test";
import {
  coverageMatrix,
  customFieldKey,
  duplicateMatches,
  isSystemField,
  lifecycleCheck,
  qualificationTotal,
  reviewStatesFor,
  stageNotionCsv,
} from "@/lib/vendor-gold";

describe("vendor gold standard", () => {
  it("totals the 100-point score and clamps each part", () => {
    expect(qualificationTotal({ score_capacity: 20, score_responsiveness: 15, score_quality: 20, score_hospitality: 15, score_communication: 10, score_pricing: 10, score_references: 10 })).toBe(100);
    expect(qualificationTotal({ score_capacity: 99 })).toBe(20);
  });
  it("a failed gate is never overridden by a high score", () => {
    expect(lifecycleCheck({ target: "gold", gatesClear: false, criticalFailure: false, score: 100 }).ok).toBe(false);
    expect(lifecycleCheck({ target: "approved", gatesClear: true, criticalFailure: false, score: 60 }).ok).toBe(true);
    expect(lifecycleCheck({ target: "pilot", gatesClear: false, criticalFailure: false, score: 84 }).ok).toBe(false);
    expect(lifecycleCheck({ target: "pilot", gatesClear: false, criticalFailure: false, score: 85 }).ok).toBe(true);
  });
  it("protects system fields and slugs custom columns", () => {
    expect(isSystemField("dispatch_method")).toBe(true);
    expect(isSystemField("cf_gate_code")).toBe(false);
    expect(customFieldKey("Gate Code #")).toBe("cf_gate_code");
  });
  it("coverage shows Missing Primary / Missing Backup / Complete", () => {
    const rows = [
      { orgId: "a", orgName: "AirWorks", market: "OKC", category: "HVAC", preference: "primary" as const, status: "gold", isActive: true },
      { orgId: "b", orgName: "CoolCo", market: "OKC", category: "HVAC", preference: "backup" as const, status: "approved", isActive: true },
      { orgId: "c", orgName: "Cand", market: "Tulsa", category: "HVAC", preference: "primary" as const, status: "candidate", isActive: true },
      { orgId: "d", orgName: "Pipes", market: "Tulsa", category: "Plumbing", preference: "primary" as const, status: "approved", isActive: true },
    ];
    const cells = coverageMatrix(["OKC", "Tulsa"], [{ label: "HVAC", tier: "critical" }, { label: "Plumbing", tier: "critical" }], rows);
    const get = (m: string, c: string) => cells.find((x) => x.market === m && x.category === c)!.status;
    expect(get("OKC", "HVAC")).toBe("complete");
    expect(get("Tulsa", "HVAC")).toBe("missing_both"); // candidates don't count
    expect(get("Tulsa", "Plumbing")).toBe("missing_backup");
    expect(get("OKC", "Plumbing")).toBe("missing_both");
  });
  it("flags duplicates by name/phone/email/site without merging", () => {
    const existing = [{ id: "1", name: "AirWorks LLC", phone: "(405) 555-0101", email: "a@x.com", website: "https://www.airworks.com" }];
    expect(duplicateMatches({ id: "n", name: "Airworks" }, existing)).toEqual(["1"]);
    expect(duplicateMatches({ id: "n", name: "Other", phone: "405-555-0101" }, existing)).toEqual(["1"]);
    expect(duplicateMatches({ id: "n", name: "Other", website: "airworks.com/contact" }, existing)).toEqual(["1"]);
    expect(duplicateMatches({ id: "n", name: "Nope" }, existing)).toEqual([]);
  });
  it("assigns migration review states", () => {
    const s = reviewStatesFor({ company: "X", phone: null, email: null, markets: [], specialties: ["HVAC"], legacyStatus: "Inactive", duplicates: ["1"] });
    expect(s).toContain("possible_duplicate");
    expect(s).toContain("missing_contact");
    expect(s).toContain("missing_market");
    expect(s).toContain("archive_candidate");
    expect(s).not.toContain("ready");
    const ok = reviewStatesFor({ company: "X", phone: "1", email: null, markets: ["OKC"], specialties: ["HVAC"], legacyStatus: null, duplicates: [] });
    expect(ok).toEqual(["ready", "needs_dispatch_setup"]);
  });
  it("stages a Notion CSV, keeping unknown columns", () => {
    const rows = stageNotionCsv('Company,Market,Specialty,In Breezeway,Secret Sauce\n"AirWorks, LLC","OKC, Tulsa",HVAC,Yes,"line1\nline2"\n');
    expect(rows).toHaveLength(1);
    expect(rows[0]!.company).toBe("AirWorks, LLC");
    expect(rows[0]!.markets).toEqual(["OKC", "Tulsa"]);
    expect(rows[0]!.breezeway_hint).toBe(true);
    expect(rows[0]!.legacy_fields).toEqual({ "Secret Sauce": "line1\nline2" });
  });
});
