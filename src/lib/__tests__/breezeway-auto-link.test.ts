import { describe, expect, it } from "bun:test";
import { linkNoticeFor, planAutoLinks, type AutoLinkHome, type AutoLinkProperty } from "@/lib/breezeway-auto-link";
import { autoLinkBreezewayHomes } from "@/lib/breezeway-auto-link.server";

const home = (over: Partial<AutoLinkProperty> = {}): AutoLinkProperty => ({
  id: "p1",
  is_demo: false,
  archived_at: null,
  active: true,
  ownerrez_property_id: "411001",
  breezeway_property_id: null,
  breezeway_mapping_state: "unmapped",
  ...over,
});
const bw = (id: number, ref: string | null, status = "active"): AutoLinkHome => ({
  id,
  status,
  referenceExternalPropertyId: ref,
});

describe("automatic Breezeway link rule", () => {
  it("links a home when exactly one active Breezeway home has its OwnerRez number", () => {
    expect(planAutoLinks([home()], [bw(900, "411001"), bw(901, "411002")])).toEqual([
      { propertyId: "p1", action: "link", breezewayHomeId: "900", ownerrezId: "411001" },
    ]);
  });

  it("leaves the home alone when two active Breezeway homes have the same OwnerRez number", () => {
    const [d] = planAutoLinks([home()], [bw(900, "411001"), bw(901, "411001")]);
    expect(d).toEqual({ propertyId: "p1", action: "skip", reason: "several_matches" });
  });

  it("leaves the home alone when no Breezeway home matches", () => {
    expect(planAutoLinks([home()], [bw(900, "999")])[0]).toMatchObject({ action: "skip", reason: "no_match" });
  });

  it("ignores Breezeway homes that are not active", () => {
    expect(planAutoLinks([home()], [bw(900, "411001", "inactive")])[0]).toMatchObject({ reason: "no_match" });
  });

  it("never changes a home that is already linked", () => {
    const linked = home({ breezeway_property_id: "777", breezeway_mapping_state: "verified" });
    expect(planAutoLinks([linked], [bw(900, "411001")])[0]).toMatchObject({ reason: "already_linked" });
  });

  it("never changes a home an Admin excluded or one marked for review", () => {
    for (const state of ["excluded", "ambiguous", "inactive", "verified"]) {
      expect(planAutoLinks([home({ breezeway_mapping_state: state })], [bw(900, "411001")])[0]).toMatchObject({
        reason: "not_unmapped",
      });
    }
  });

  it("skips demo, archived and switched-off homes, and homes with no OwnerRez number", () => {
    const homes = [
      home({ id: "a", is_demo: true }),
      home({ id: "b", archived_at: "2026-11-01T00:00:00Z" }),
      home({ id: "c", active: false }),
      home({ id: "d", ownerrez_property_id: "  " }),
    ];
    expect(planAutoLinks(homes, [bw(900, "411001")]).map((d) => d.action === "skip" && d.reason)).toEqual([
      "not_eligible",
      "not_eligible",
      "not_eligible",
      "no_ownerrez_number",
    ]);
  });

  it("never gives a Breezeway home already used by another Resolve home, even an archived one", () => {
    const other = home({ id: "old", archived_at: "2026-01-01T00:00:00Z", breezeway_property_id: "900", breezeway_mapping_state: "verified" });
    expect(planAutoLinks([home(), other], [bw(900, "411001")], ["p1"])[0]).toMatchObject({ reason: "home_taken" });
  });

  it("links neither home when two Resolve homes in one pass reach the same Breezeway home", () => {
    const out = planAutoLinks([home({ id: "x" }), home({ id: "y" })], [bw(900, "411001")]);
    expect(out.map((d) => d.action === "skip" && d.reason)).toEqual(["home_taken", "home_taken"]);
  });

  it("checks only the named homes when given a list", () => {
    const out = planAutoLinks([home({ id: "x" }), home({ id: "y", ownerrez_property_id: "411002" })], [bw(900, "411001"), bw(901, "411002")], ["y"]);
    expect(out).toEqual([{ propertyId: "y", action: "link", breezewayHomeId: "901", ownerrezId: "411002" }]);
  });
});

/** Small stand-in for the admin client: properties select/update and audit_log insert. */
function fakeDb(rows: Record<string, unknown>[], admins: string[] = ["admin-1", "admin-2"]) {
  const audits: Record<string, unknown>[] = [];
  const notices: Record<string, unknown>[] = [];
  const db = {
    from(table: string) {
      if (table === "audit_log") {
        return { insert: async (row: Record<string, unknown>) => { audits.push(row); return { error: null }; } };
      }
      if (table === "user_roles") {
        return { select: () => ({ eq: async (_k: string, v: string) => ({ data: v === "admin" ? admins.map((user_id) => ({ user_id })) : [], error: null }) }) };
      }
      if (table === "staff_notifications") {
        return {
          select: () => {
            let kind: unknown; let ids: unknown[] = [];
            const q = {
              eq(_k: string, v: unknown) { kind = v; return q; },
              in(_k: string, v: unknown[]) { ids = v; return q; },
              async is() {
                return { data: notices.filter((n) => n["kind"] === kind && ids.includes(n["entity_id"]) && !n["retracted_at"]), error: null };
              },
            };
            return q;
          },
          insert: async (list: Record<string, unknown>[]) => { notices.push(...list); return { error: null }; },
        };
      }
      return {
        select: async () => ({ data: rows.map((r) => ({ ...r })), error: null }),
        update(patch: Record<string, unknown>) {
          const conds: [string, unknown][] = [];
          const chain = {
            eq(k: string, v: unknown) { conds.push([k, v]); return chain; },
            is(k: string, v: unknown) { conds.push([k, v]); return chain; },
            async select() {
              const hit = rows.filter((r) => conds.every(([k, v]) => (r[k] ?? null) === v));
              for (const r of hit) Object.assign(r, patch);
              return { data: hit.map((r) => ({ id: r["id"] })), error: null };
            },
          };
          return chain;
        },
      };
    },
  };
  return { db, audits, rows, notices };
}

describe("automatic Breezeway link save", () => {
  const base = { is_demo: false, archived_at: null, active: true, name: "Home", address_line1: "1 Main St", breezeway_property_id: null, breezeway_mapping_state: "unmapped" };

  it("saves the link as verified with the note and writes one change-log entry", async () => {
    const f = fakeDb([{ ...base, id: "p1", ownerrez_property_id: "411001" }]);
    const res = await autoLinkBreezewayHomes(f.db, {
      trigger: "add_home",
      propertyIds: ["p1"],
      addedBy: "u1",
      now: new Date("2026-11-16T22:00:00Z"),
      listHomes: async () => [bw(900, "411001")],
    });
    expect(res.linked).toEqual([{ propertyId: "p1", breezewayHomeId: "900" }]);
    expect(f.rows[0]).toMatchObject({
      breezeway_property_id: "900",
      breezeway_mapping_state: "verified",
      breezeway_mapping_note: "Matched by OwnerRez number.",
      breezeway_mapping_verified_at: "2026-11-16T22:00:00.000Z",
    });
    expect(f.audits).toHaveLength(1);
    expect(f.audits[0]).toMatchObject({ action: "breezeway_auto_matched", entity_id: "p1", reason: "Matched by OwnerRez number.", actor_id: null });
  });

  it("leaves excluded, review and linked homes exactly as they were", async () => {
    const f = fakeDb([
      { ...base, id: "ex", ownerrez_property_id: "1", breezeway_mapping_state: "excluded" },
      { ...base, id: "am", ownerrez_property_id: "2", breezeway_mapping_state: "ambiguous" },
      { ...base, id: "ln", ownerrez_property_id: "3", breezeway_property_id: "55", breezeway_mapping_state: "verified" },
      { ...base, id: "ok", ownerrez_property_id: "4" },
    ]);
    const before = JSON.stringify(f.rows.slice(0, 3));
    const res = await autoLinkBreezewayHomes(f.db, {
      trigger: "nightly",
      listHomes: async () => [bw(901, "1"), bw(902, "2"), bw(903, "3"), bw(904, "4")],
    });
    expect(JSON.stringify(f.rows.slice(0, 3))).toBe(before);
    expect(res.linked).toEqual([{ propertyId: "ok", breezewayHomeId: "904" }]);
    expect(f.audits).toHaveLength(1);
  });

  it("does not read Breezeway when nothing needs a link", async () => {
    const f = fakeDb([{ ...base, id: "ln", ownerrez_property_id: "3", breezeway_property_id: "55", breezeway_mapping_state: "verified" }]);
    let called = false;
    const res = await autoLinkBreezewayHomes(f.db, { trigger: "nightly", listHomes: async () => { called = true; return []; } });
    expect(called).toBe(false);
    expect(res.linked).toEqual([]);
  });

  it("writes nothing when there are two matches or none", async () => {
    const f = fakeDb([{ ...base, id: "a", ownerrez_property_id: "1" }, { ...base, id: "b", ownerrez_property_id: "2" }]);
    const res = await autoLinkBreezewayHomes(f.db, { trigger: "nightly", listHomes: async () => [bw(901, "1"), bw(902, "1")] });
    expect(res.linked).toEqual([]);
    expect(res.skipped).toEqual({ several_matches: 1, no_match: 1 });
    expect(f.rows.every((r) => r["breezeway_mapping_state"] === "unmapped" && r["breezeway_property_id"] === null)).toBe(true);
    expect(f.audits).toHaveLength(0);
  });
});

describe("telling an Admin when a home cannot link itself", () => {
  const base = { is_demo: false, archived_at: null, active: true, name: "Home", unit: null, city: "Tulsa", state: "OK", postal_code: "74137", breezeway_property_id: null, breezeway_mapping_state: "unmapped" };

  it("sends every Admin one in-app notice naming the home and the reason", async () => {
    const f = fakeDb([{ ...base, id: "p1", address_line1: "8738 Comstock Ct", ownerrez_property_id: "411001" }]);
    const res = await autoLinkBreezewayHomes(f.db, { trigger: "add_home", propertyIds: ["p1"], listHomes: async () => [] });
    expect(res.notified).toEqual(["p1"]);
    expect(f.notices.map((n) => n["user_id"])).toEqual(["admin-1", "admin-2"]);
    expect(f.notices[0]).toMatchObject({
      kind: "breezeway_link_needed",
      title: "Breezeway link needed: 8738 Comstock Ct",
      entity_type: "property",
      entity_id: "p1",
      link_path: "/integrations",
    });
    expect(String(f.notices[0]!["body"])).toContain("No active Breezeway home has its OwnerRez number yet.");
    // In-app only: no email is asked for.
    expect("email_status" in f.notices[0]!).toBe(false);
  });

  it("names the reason for two matches, no OwnerRez number, and a Breezeway home already in use", () => {
    expect(linkNoticeFor("several_matches", "1 Main St")!.body).toContain("More than one Breezeway home has its OwnerRez number.");
    expect(linkNoticeFor("no_ownerrez_number", "1 Main St")!.body).toContain("It has no OwnerRez number");
    expect(linkNoticeFor("home_taken", "1 Main St")!.body).toContain("already linked to another home in Resolve");
  });

  it("tells nobody about demo, archived, linked, excluded or review homes", () => {
    for (const reason of ["not_eligible", "already_linked", "not_unmapped", "changed_meanwhile"]) {
      expect(linkNoticeFor(reason, "1 Main St")).toBeNull();
    }
  });

  it("does not repeat the same notice each night, but sends a new one when the reason changes", async () => {
    const f = fakeDb([{ ...base, id: "p1", address_line1: "1 Main St", ownerrez_property_id: "411001" }]);
    await autoLinkBreezewayHomes(f.db, { trigger: "nightly", listHomes: async () => [] });
    const again = await autoLinkBreezewayHomes(f.db, { trigger: "nightly", listHomes: async () => [] });
    expect(again.notified).toEqual([]);
    expect(f.notices).toHaveLength(2);
    const changed = await autoLinkBreezewayHomes(f.db, { trigger: "nightly", listHomes: async () => [bw(1, "411001"), bw(2, "411001")] });
    expect(changed.notified).toEqual(["p1"]);
    expect(f.notices).toHaveLength(4);
  });

  it("sends no notice when the home links itself", async () => {
    const f = fakeDb([{ ...base, id: "p1", address_line1: "1 Main St", ownerrez_property_id: "411001" }]);
    const res = await autoLinkBreezewayHomes(f.db, { trigger: "nightly", listHomes: async () => [bw(900, "411001")] });
    expect(res.linked).toHaveLength(1);
    expect(f.notices).toHaveLength(0);
  });
});
