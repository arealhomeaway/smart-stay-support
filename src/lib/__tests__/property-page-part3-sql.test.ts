// @ts-nocheck: isolated SQL fixture, row shapes are checked by assertions.
import { beforeEach, describe, expect, it } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

/**
 * Practice run of docs/pending/property-page-part3/apply.sql (and its undo) on an isolated copy
 * (Property page Part 3, Admin approval Nov 12). Live column names, fake people and homes only.
 */
const DIR = "docs/pending/property-page-part3";
const ADMIN = "00000000-0000-4000-8000-0000000000a0";
const DIRECTOR = "00000000-0000-4000-8000-0000000000a1";
const PM = "00000000-0000-4000-8000-0000000000a2";
const DESIGNER = "00000000-0000-4000-8000-0000000000a3";
const OTHER_PM = "00000000-0000-4000-8000-0000000000a4";
const OPS_DIRECTOR = "00000000-0000-4000-8000-0000000000a5";
const HOME = "00000000-0000-4000-8000-0000000000b1";
const PROJECT = "00000000-0000-4000-8000-0000000000e1";
const PLUMBER = "00000000-0000-4000-8000-0000000000f2";
const DOC = "00000000-0000-4000-8000-0000000000d1";
const TASK_DOC = "00000000-0000-4000-8000-0000000000d2";

let db: PGlite;
const as = async (user: string | null) => {
  await db.query("DELETE FROM public.me");
  if (user) await db.query("INSERT INTO public.me VALUES ($1)", [user]);
};
const one = async (sql: string, args: unknown[] = []) => (await db.query(sql, args)).rows[0];
const fails = async (p: Promise<unknown>) => {
  try { await p; } catch (e) { return String((e as Error).message); }
  throw new Error("expected a refusal");
};

beforeEach(async () => {
  db = new PGlite();
  await db.exec(readFileSync("src/lib/__tests__/fixtures/property-page-part3-schema.sql", "utf8"));
  await db.exec(readFileSync(`${DIR}/live-capture/documents_category_chk.sql`, "utf8"));
  await db.exec(`
    INSERT INTO public.user_roles VALUES ('${ADMIN}','admin'), ('${DIRECTOR}','onboarding'), ('${PM}','onboarding'), ('${DESIGNER}','onboarding'), ('${OTHER_PM}','onboarding');
    INSERT INTO public.directors VALUES ('${DIRECTOR}');
    INSERT INTO public.functional_role_members VALUES ('director_ops', '${OPS_DIRECTOR}');
    INSERT INTO public.onboarding_projects(id, property_id, project_manager, role_assignments) VALUES ('${PROJECT}', '${HOME}', '${PM}', '{"designer":"${DESIGNER}"}');
    INSERT INTO public.vendor_orgs(id, display_name, service_categories) VALUES ('${PLUMBER}', 'Pipes', '{Plumbing}');
    INSERT INTO public.documents(id, entity_type, entity_id, property_id, original_filename) VALUES
      ('${DOC}', 'property', '${HOME}', '${HOME}', 'plan.pdf'), ('${TASK_DOC}', 'onboarding_task', '${HOME}', '${HOME}', 'invoice.pdf');
  `);
  await db.exec(readFileSync(`${DIR}/apply.sql`, "utf8"));
});

describe("Telegram and LOA (3.1)", () => {
  it("the home's PM saves a t.me link; history and audit carry who", async () => {
    await as(PM);
    await one("SELECT public.save_home_detail_field($1, 'telegram_url', 'https://t.me/home_group')", [PROJECT]);
    expect((await one("SELECT telegram_url FROM public.onboarding_projects")).telegram_url).toBe("https://t.me/home_group");
    const ev = await one("SELECT summary, actor, new_value FROM public.onboarding_project_events WHERE kind = 'project_detail_changed'");
    expect(ev).toEqual({ summary: "Telegram group changed", actor: PM, new_value: "https://t.me/home_group" });
    expect((await one("SELECT count(*)::int n FROM public.audit_log WHERE action = 'onboarding.detail_changed'")).n).toBe(1);
  });
  it("refuses a link that is not t.me", async () => {
    await as(PM);
    expect(await fails(db.query("SELECT public.save_home_detail_field($1, 'telegram_url', 'https://example.com/x')", [PROJECT]))).toContain("t.me");
  });
  it("refuses a PM of another home and the home's Designer", async () => {
    await as(OTHER_PM);
    expect(await fails(db.query("SELECT public.save_home_detail_field($1, 'loa_status', 'signed')", [PROJECT]))).toContain("Project Manager");
    await as(DESIGNER);
    expect(await fails(db.query("SELECT public.save_home_detail_field($1, 'loa_status', 'signed')", [PROJECT]))).toContain("Project Manager");
  });
  it("the Director saves LOA; an unknown field is refused", async () => {
    await as(DIRECTOR);
    await one("SELECT public.save_home_detail_field($1, 'loa_status', 'signed')", [PROJECT]);
    expect((await one("SELECT loa_status FROM public.onboarding_projects")).loa_status).toBe("signed");
    expect(await fails(db.query("SELECT public.save_home_detail_field($1, 'project_manager', 'x')", [PROJECT]))).toContain("cannot be saved");
  });
});

describe("Files folders (3.2)", () => {
  it("the two new folders are accepted on documents", async () => {
    await db.query("UPDATE public.documents SET category = 'agreement' WHERE id = $1", [DOC]);
    await db.query("UPDATE public.documents SET category = 'estimate_invoice' WHERE id = $1", [TASK_DOC]);
    expect((await one("SELECT count(*)::int n FROM public.documents WHERE category IN ('agreement','estimate_invoice')")).n).toBe(2);
  });
  it("the home's Designer files a Task file; who is in history and audit", async () => {
    await as(DESIGNER);
    await one("SELECT public.move_home_file($1, 'estimate_invoice')", [TASK_DOC]);
    expect((await one("SELECT category FROM public.documents WHERE id = $1", [TASK_DOC])).category).toBe("estimate_invoice");
    expect((await one("SELECT actor FROM public.onboarding_project_events WHERE kind = 'file_filed'")).actor).toBe(DESIGNER);
    expect((await one("SELECT count(*)::int n FROM public.audit_log WHERE action = 'document.folder_changed'")).n).toBe(1);
  });
  it("nothing new goes into Other", async () => {
    await as(PM);
    expect(await fails(db.query("SELECT public.move_home_file($1, 'other')", [DOC]))).toContain("Other");
    expect(await fails(db.query("SELECT public.move_home_file($1, NULL)", [DOC]))).toContain("Choose a folder");
  });
  it("someone off the team is refused; the Director of Operations may file", async () => {
    await as(OTHER_PM);
    expect(await fails(db.query("SELECT public.move_home_file($1, 'design')", [DOC]))).toContain("team");
    await as(OPS_DIRECTOR);
    await one("SELECT public.move_home_file($1, 'design')", [DOC]);
    expect((await one("SELECT category FROM public.documents WHERE id = $1", [DOC])).category).toBe("design");
  });
});

describe("vendor preferred contact (3.3)", () => {
  it("only call, text or email", async () => {
    await db.query("UPDATE public.vendor_orgs SET preferred_contact = 'text' WHERE id = $1", [PLUMBER]);
    expect(await fails(db.query("UPDATE public.vendor_orgs SET preferred_contact = 'fax' WHERE id = $1", [PLUMBER]))).toContain("check");
  });
});

describe("undo", () => {
  it("puts the captured live objects back", async () => {
    await db.exec(readFileSync(`${DIR}/apply.undo.sql`, "utf8"));
    expect((await one("SELECT to_regprocedure('public.move_home_file(uuid,text)') r")).r).toBeNull();
    expect((await one("SELECT count(*)::int n FROM information_schema.columns WHERE table_name = 'onboarding_projects' AND column_name IN ('telegram_url','loa_status')")).n).toBe(0);
    expect(await fails(db.query("UPDATE public.documents SET category = 'agreement' WHERE id = $1", [DOC]))).toContain("check");
    expect((await one("SELECT to_regprocedure('public.save_home_detail_field(uuid,text,text)') r")).r).toBeNull();
  });
});
