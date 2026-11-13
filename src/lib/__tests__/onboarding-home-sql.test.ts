// @ts-nocheck: isolated SQL fixture, row shapes are checked by assertions.
import { beforeEach, describe, expect, it } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

/**
 * Practice run of docs/pending/onboarding-home/apply.sql (and its undo) on an isolated copy
 * (Onboarding Home as the project database, Admin approval Nov 12). Fake people and homes only.
 * 3.3: Add a home, Upcoming, Contract fell through, Not an onboarding home and stager
 * assignment are the Admin's and the Director's; saved views and columns are each person's own.
 */
const DIR = "docs/pending/onboarding-home";
const ADMIN = "00000000-0000-4000-8000-0000000000a0";
const DIRECTOR = "00000000-0000-4000-8000-0000000000a1";
const PM = "00000000-0000-4000-8000-0000000000a2";
const DESIGNER = "00000000-0000-4000-8000-0000000000a3";
const OPS = "00000000-0000-4000-8000-0000000000a4";
const STAGER = "00000000-0000-4000-8000-0000000000c1";
const STAGER_2 = "00000000-0000-4000-8000-0000000000c2";
const PLUMBER = "00000000-0000-4000-8000-0000000000c3";
const HOME = "00000000-0000-4000-8000-0000000000b1";
const REQ = "00000000-0000-4000-8000-0000000000d1";

let db: PGlite;
const as = async (user: string | null) => {
  await db.query("DELETE FROM public.me");
  if (user) await db.query("INSERT INTO public.me VALUES ($1)", [user]);
};
const one = async (sql: string, args: unknown[] = []) => (await db.query(sql, args)).rows[0];
const count = async (sql: string, args: unknown[] = []) => Number((await one(sql, args)).n);
const fails = async (p: Promise<unknown>) => {
  try { await p; } catch (e) { return String((e as Error).message); }
  throw new Error("expected a refusal");
};
const LEAD_ONLY = "Only the Director of Onboarding or an Admin can do this.";
const addUpcoming = (o: Record<string, unknown> = {}) =>
  one("SELECT public.add_upcoming_onboarding_home($1::uuid, $2, $3, $4, $5, $6, $7::date, $8, $9) AS r",
    [o.req ?? REQ, o.street ?? "1399 Foxtail Ln", null, "Round Rock", "TX", "78664", o.closing ?? "2026-12-15", o.contact ?? "DFY lead, 512 555 0100", o.note ?? null]).then((x) => x.r);
const stagers = (project: string, ids: string[]) => one("SELECT public.set_onboarding_project_stagers($1, $2::uuid[]) AS r", [project, ids]).then((x) => x.r);
let project: string;

beforeEach(async () => {
  db = new PGlite();
  await db.exec(readFileSync("src/lib/__tests__/fixtures/onboarding-home-schema.sql", "utf8"));
  await db.exec(`
    INSERT INTO public.user_roles VALUES ('${ADMIN}','admin'), ('${DIRECTOR}','onboarding'), ('${PM}','onboarding'), ('${DESIGNER}','onboarding'), ('${OPS}','manager');
    INSERT INTO public.directors VALUES ('${DIRECTOR}');
    INSERT INTO public.functional_roles VALUES ('onboarding_director', '${DIRECTOR}', true);
    INSERT INTO public.properties(id, name) VALUES ('${HOME}', 'Oak House');
    INSERT INTO public.vendor_orgs VALUES ('${STAGER}', 'Stage Co', '{Staging}'), ('${STAGER_2}', 'Second Stage', '{Staging,Cleaning}'), ('${PLUMBER}', 'Pipes', '{Plumbing}');
  `);
  project = (await one(`INSERT INTO public.onboarding_projects(property_id, status, project_manager) VALUES ('${HOME}', 'active', '${PM}') RETURNING id`)).id;
  await db.exec(readFileSync(`${DIR}/00_preflight.sql`, "utf8"));
  await db.exec(readFileSync(`${DIR}/apply.sql`, "utf8"));
});

describe("the tiles switch", () => {
  it("is added off", async () => {
    expect((await one("SELECT enabled FROM public.feature_flags WHERE key = 'onboarding_home_tiles'")).enabled).toBe(false);
  });
  it("the preflight stops a second run before anything is written", async () => {
    expect(await fails(db.exec(readFileSync(`${DIR}/00_preflight.sql`, "utf8")))).toContain("already exists");
  });
});

describe("3.3 who may change homes from the list", () => {
  it("a PM, a Designer and other staff are refused every lead action; nothing is written", async () => {
    for (const who of [PM, DESIGNER, OPS]) {
      await as(who);
      expect(await fails(addUpcoming())).toContain(LEAD_ONLY);
      expect(await fails(stagers(project, [STAGER]))).toContain(LEAD_ONLY);
      expect(await fails(one("SELECT public.mark_contract_fell_through($1, 'Buyer walked away')", [project]))).toContain(LEAD_ONLY);
      expect(await fails(one("SELECT public.start_upcoming_onboarding_home($1)", [project]))).toContain(LEAD_ONLY);
      expect(await fails(one("SELECT public.dismiss_ownerrez_listing('123', 'Lake cabin', 'Owner kept it')"))).toContain(LEAD_ONLY);
    }
    await as(null);
    expect(await fails(addUpcoming())).toContain(LEAD_ONLY);
    expect(await count("SELECT count(*) n FROM public.audit_log")).toBe(0);
    expect(await count("SELECT count(*) n FROM public.onboarding_project_stagers")).toBe(0);
  });
});

describe("2.5 Upcoming and Contract fell through", () => {
  it("the Director adds an Upcoming home: no plan, Director set, contact kept as a note, logged; a retry returns the same home", async () => {
    await as(DIRECTOR);
    const r = await addUpcoming({ note: "Expects to close mid December" });
    expect(r.ok).toBe(true);
    const p = await one("SELECT status, project_status, director, planned_closing_on::text c FROM public.onboarding_projects WHERE id = $1", [r.project_id]);
    expect(p).toEqual({ status: "planning", project_status: "Upcoming Property", director: DIRECTOR, c: "2026-12-15" });
    expect(await count("SELECT count(*) n FROM public.onboarding_tasks WHERE property_id = $1", [r.property_id])).toBe(0);
    expect((await one("SELECT body FROM public.onboarding_notes WHERE property_id = $1", [r.property_id])).body).toBe("Owner or DFY contact: DFY lead, 512 555 0100\nExpects to close mid December");
    expect((await one("SELECT kind FROM public.onboarding_project_events WHERE project_id = $1", [r.project_id])).kind).toBe("upcoming_added");
    const again = await addUpcoming();
    expect(again.repeat).toBe(true);
    expect(again.property_id).toBe(r.property_id);
    expect(await count("SELECT count(*) n FROM public.properties")).toBe(2);
  });

  it("Under contract moves an Upcoming home to active once; a second click changes nothing", async () => {
    await as(ADMIN);
    const r = await addUpcoming();
    await one("SELECT public.start_upcoming_onboarding_home($1)", [r.project_id]);
    expect(await one("SELECT status, project_status FROM public.onboarding_projects WHERE id = $1", [r.project_id])).toEqual({ status: "active", project_status: null });
    const again = (await one("SELECT public.start_upcoming_onboarding_home($1) AS r", [r.project_id])).r;
    expect(again.repeat).toBe(true);
    expect(await count("SELECT count(*) n FROM public.onboarding_project_events WHERE kind = 'under_contract'")).toBe(1);
  });

  it("Contract fell through needs a reason, records who and when, and frees the address for a new project", async () => {
    await as(DIRECTOR);
    const r = await addUpcoming();
    expect(await fails(one("SELECT public.mark_contract_fell_through($1, '')", [r.project_id]))).toContain("Give a short reason.");
    await one("SELECT public.mark_contract_fell_through($1, 'Buyer financing fell through')", [r.project_id]);
    const p = await one("SELECT status, project_status, closed_reason, closed_by, closed_at IS NOT NULL closed FROM public.onboarding_projects WHERE id = $1", [r.project_id]);
    expect(p).toEqual({ status: "cancelled", project_status: "Contract Fell Through", closed_reason: "Buyer financing fell through", closed_by: DIRECTOR, closed: true });
    expect((await one("SELECT reason FROM public.audit_log WHERE action = 'onboarding.contract_fell_through'")).reason).toBe("Buyer financing fell through");
    expect((await one("SELECT detail FROM public.onboarding_project_events WHERE kind = 'contract_fell_through'")).detail).toBe("Buyer financing fell through");
    await db.query("INSERT INTO public.onboarding_projects(property_id, status) VALUES ($1, 'active')", [r.property_id]);
    expect(await count("SELECT count(*) n FROM public.onboarding_projects WHERE property_id = $1", [r.property_id])).toBe(2);
  });

  it("a home with a plan can never be closed as Contract fell through", async () => {
    await db.exec(`INSERT INTO public.onboarding_tasks(property_id, title) VALUES ('${HOME}', 'Order the welcome book')`);
    await as(ADMIN);
    expect(await fails(one("SELECT public.mark_contract_fell_through($1, 'Changed our minds')", [project]))).toContain("Only an Upcoming home with no plan");
    expect((await one("SELECT status FROM public.onboarding_projects WHERE id = $1", [project])).status).toBe("active");
  });
});

describe("3.2 stagers are vendors", () => {
  it("several staging vendors per home, never a non-staging vendor; changes are logged and undoable", async () => {
    await as(DIRECTOR);
    expect(await fails(stagers(project, [PLUMBER]))).toContain("Pick a stager from the staging vendors.");
    expect((await stagers(project, [STAGER, STAGER_2])).added).toBe(2);
    expect(await count("SELECT count(*) n FROM public.onboarding_project_stagers WHERE removed_at IS NULL")).toBe(2);
    // Undo = put back the list from before; the removed row stays as history.
    expect((await stagers(project, [STAGER])).removed).toBe(1);
    expect(await count("SELECT count(*) n FROM public.onboarding_project_stagers")).toBe(2);
    expect(await count("SELECT count(*) n FROM public.onboarding_project_stagers WHERE removed_at IS NULL")).toBe(1);
    expect(await count("SELECT count(*) n FROM public.audit_log WHERE action = 'onboarding.stagers_changed'")).toBe(2);
    // The same list again changes nothing and logs nothing.
    await stagers(project, [STAGER]);
    expect(await count("SELECT count(*) n FROM public.audit_log WHERE action = 'onboarding.stagers_changed'")).toBe(2);
  });
});

describe("2.6 Not an onboarding home", () => {
  it("needs a reason, records who and when once, and a repeat adds nothing", async () => {
    await as(ADMIN);
    expect(await fails(one("SELECT public.dismiss_ownerrez_listing('123', 'Lake cabin', 'x')"))).toContain("Give a short reason.");
    await one("SELECT public.dismiss_ownerrez_listing('123', 'Lake cabin', 'Owner kept it for family use')");
    await one("SELECT public.dismiss_ownerrez_listing('123', 'Lake cabin', 'Again')");
    const d = await one("SELECT listing_id, reason, dismissed_by FROM public.ownerrez_listing_dismissals");
    expect(d).toEqual({ listing_id: "123", reason: "Owner kept it for family use", dismissed_by: ADMIN });
    expect(await count("SELECT count(*) n FROM public.ownerrez_listing_dismissals")).toBe(1);
    expect(await count("SELECT count(*) n FROM public.audit_log WHERE action = 'onboarding.ownerrez_not_onboarding'")).toBe(1);
  });
});

describe("saved views and columns are each person's own", () => {
  it("anyone on the onboarding team saves views by name and one Columns choice; unknown columns are refused", async () => {
    await as(PM);
    await one("SELECT public.save_onboarding_home_view('Behind in Austin', '{\"sched\":\"behind\",\"market\":\"Austin\"}', 'table', NULL)");
    await one("SELECT public.save_onboarding_home_view('behind in austin', '{\"sched\":\"behind\"}', 'gallery', NULL)");
    expect(await count("SELECT count(*) n FROM public.saved_views WHERE kind = 'view'")).toBe(1);
    expect((await one("SELECT view FROM public.saved_views WHERE kind = 'view'")).view).toBe("gallery");
    await one("SELECT public.save_onboarding_home_columns('{market,hoa}')");
    await one("SELECT public.save_onboarding_home_columns('{possession}')");
    expect((await one("SELECT columns FROM public.saved_views WHERE kind = 'columns'")).columns).toEqual(["possession"]);
    expect(await fails(one("SELECT public.save_onboarding_home_columns('{pay_date}')"))).toContain("Unknown column.");
    const id = (await one("SELECT id FROM public.saved_views WHERE kind = 'view'")).id;
    await as(DESIGNER);
    expect(await fails(one("SELECT public.archive_onboarding_home_view($1)", [id]))).toContain("not found");
    await as(PM);
    await one("SELECT public.archive_onboarding_home_view($1)", [id]);
    expect(await count("SELECT count(*) n FROM public.saved_views WHERE archived_at IS NOT NULL")).toBe(1);
  });
});

describe("undo", () => {
  it("removes every new function, keeps the switch off and every row", async () => {
    await as(DIRECTOR);
    await addUpcoming();
    await db.exec(readFileSync(`${DIR}/apply.undo.sql`, "utf8"));
    expect(await fails(addUpcoming())).toContain("does not exist");
    expect(await count("SELECT count(*) n FROM public.onboarding_projects WHERE project_status = 'Upcoming Property'")).toBe(1);
    expect((await one("SELECT enabled FROM public.feature_flags WHERE key = 'onboarding_home_tiles'")).enabled).toBe(false);
  });
});
