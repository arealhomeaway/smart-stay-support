import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";

/** Clean slate (Emily, Nov 7, 2026; register N8): staged only. Guards on the staged files. */
const DIR = "docs/pending/clean-slate";
const read = (p: string) => readFileSync(`${DIR}/${p}`, "utf8");
const T01 = read("01_delete_all_tickets.sql");
const T01B = read("01b_optional_ticket_log_lines.sql");
const T02 = read("02_delete_test_accounts.sql");
const T02B = read("02b_delete_test_logins.ts");
const GATE = "WHERE status = 'succeeded' AND verify_ok IS TRUE AND finished_at >= now() - interval '2 hours'";

const ids = (s: string) => [...s.matchAll(/'([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})'/g)].map((m) => m[1]);
const REAL = [
  "bb286c4d-7751-47b5-bba2-e1590ba50841", "830332a2-3cee-4967-bd57-7cd625f8f9f9", "80c6e551-e370-4ab3-bdfd-1cd7f5c39448",
  "68ad7bb6-458f-4c0c-921f-3299251ac3fa", "e4a697e6-e392-46af-a9c6-a49f815db103", "bc62d95a-94fb-4b59-838b-55b9a25db6b9",
  "98bd6696-4018-4965-b645-0471c5ae3925", "82bdbc3a-791c-433a-9944-651661f89eb1", "644ffc2f-b0a1-4bc7-8eb1-bb4e959cadce",
  "ea6708cd-7f53-4b36-bec8-f5b2a597e6db", "f8c6e258-6679-4517-a8bc-4817ec1cb5de", "40de2f41-5596-4ec1-98d7-29e16549a25f",
  "452f6db5-ba38-44bf-a8bd-f4b9197a0032", "3dbc382b-cc50-426a-bba9-64141b62b4f4", "29380b2b-a59f-4de4-8588-7bcfebfc2d36",
  "1a4b8de5-0824-4066-8691-8e6bb912f964", "f2a762fa-f28b-4df3-8f33-a94461c6837f",
];

describe("every clean slate step needs a recent, checked full backup", () => {
  it("01, 01b and 02 refuse without one, before any change", () => {
    for (const s of [T01, T01B, T02]) {
      const gate = s.indexOf(GATE);
      expect(gate).toBeGreaterThan(-1);
      const firstChange = Math.min(...["DELETE FROM", "ALTER TABLE", "UPDATE public."].map((k) => (s.indexOf(k) === -1 ? Infinity : s.indexOf(k))));
      expect(gate < firstChange).toBe(true);
    }
  });
});

describe("01 deletes every ticket and switches each delete block back on", () => {
  it("each block switched off is switched on again, and checked", () => {
    const off = [...T01.matchAll(/DISABLE TRIGGER (\w+);/g)].map((m) => m[1]).sort();
    const on = [...T01.matchAll(/ENABLE TRIGGER (\w+);/g)].map((m) => m[1]).sort();
    expect(off).toEqual(["routine_controls_lock_completed", "scorecard_records_no_change", "ticket_state_log_no_change", "tickets_never_delete"]);
    expect(on).toEqual(off);
    for (const t of off) expect(T01.slice(T01.lastIndexOf("DO $$"))).toContain(`'${t}'`);
  });
  it("keeps homes, owners, vendors, settings, schedule, routines and templates", () => {
    for (const t of ["properties", "property_owners", "vendor_orgs", "app_settings", "coverage_shifts", "oncall_roster", "playbooks", "onboarding_templates", "onboarding_template_tasks", "expenses ", "guest_feedback ", "routine_controls "])
      expect(T01).not.toContain(`DELETE FROM public.${t}`);
  });
  it("only automatic opportunities made from the tickets are removed", () => {
    expect(T01).toContain("SELECT id FROM public.owner_reviews WHERE auto_ticket AND ticket_id IN (SELECT id FROM cs_tickets);");
  });
});

describe("02 removes exactly the 18 listed test accounts", () => {
  it("the SQL list and the sign-in list are the same 18 ids, each with its address", () => {
    const sql = ids(T02);
    const ts = ids(T02B.replaceAll('"', "'"));
    expect(sql.length).toBe(18);
    expect(new Set(sql).size).toBe(18);
    expect([...ts].sort()).toEqual([...sql].sort());
    for (const line of T02.split("\n").filter((l) => /^\s+\('[0-9a-f-]{36}',/.test(l)))
      expect(line).toMatch(/'(.+@(resolve-test\.invalid|example\.com|example\.invalid|demo\.arha\.test)|emily\.r\.jimenez4@gmail\.com)'/);
  });
  it("never lists a real homeowner or a real staff login", () => {
    for (const id of REAL) {
      expect(T02).not.toContain(id);
      expect(T02B).not.toContain(id);
    }
  });
  it("checks every address before it removes anything, and keeps the profile block on", () => {
    expect(T02).toContain("lower(u.email) IS DISTINCT FROM a.email");
    expect(T02B).toContain('if ((data.user.email ?? "").toLowerCase() !== email)');
    expect(T02).toContain("ALTER TABLE public.profiles ENABLE TRIGGER profiles_never_delete;");
  });
});
