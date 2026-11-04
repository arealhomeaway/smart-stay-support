import { beforeEach, describe, expect, it } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { canDeleteNow, formerName } from "../user-removal";
import { personName } from "../team-schedule";

/** Isolated PostgreSQL check of docs/pending/remove-users/01. Nothing touches the real database. */
const DIR = "docs/pending/remove-users";
const SQL = readFileSync(`${DIR}/01_remove_users.sql`, "utf8");
const UNDO = readFileSync(`${DIR}/01_undo_remove_users.sql`, "utf8");
const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const admin = U(1), staff = U(2), sup = U(3), owner = U(4), vendor = U(5), seatHolder = U(6), director = U(7), coord = U(8);

const STUBS = `
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('test.uid', true), '')::uuid $$;
CREATE TABLE public.profiles(id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE, full_name text, email text, oncall_eligible boolean DEFAULT false);
CREATE TABLE public.user_roles(user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE, role text);
CREATE TABLE public.owner_time_entries(id serial PRIMARY KEY, owner_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE, minutes int);
CREATE TABLE public.staff_notifications(id serial PRIMARY KEY, user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE);
CREATE TABLE public.documents(id serial PRIMARY KEY, uploaded_by uuid REFERENCES auth.users(id));
CREATE TABLE public.functional_role_members(role_code text, user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE);
CREATE TABLE public.department_members(user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE);
CREATE TABLE public.functional_roles(code text PRIMARY KEY, name text, backup_role_code text, current_seat_holder uuid);
CREATE TABLE public.tickets(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text, status text DEFAULT 'open', functional_role_code text, assigned_to uuid, current_action_owner uuid);
CREATE TABLE public.onboarding_tasks(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text, status text DEFAULT 'open', assigned_to uuid);
CREATE TABLE public.work_orders(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text, closed_at timestamptz, assigned_to uuid);
CREATE TABLE public.approvals(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), status text DEFAULT 'pending', approver_id uuid);
CREATE TABLE public.oncall_roster(id serial PRIMARY KEY, user_id uuid, starts_on date, ends_on date);
CREATE TABLE public.app_settings(key text PRIMARY KEY, value jsonb, updated_by uuid, updated_at timestamptz);
CREATE TABLE public.audit_log(id serial PRIMARY KEY, actor_id uuid, action text, entity_type text, entity_id uuid, before_value jsonb, after_value jsonb, created_at timestamptz DEFAULT now());
CREATE FUNCTION public.has_role(_u uuid, _r text) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_u AND role=_r) $$;
CREATE FUNCTION public.staff_assignable(_u uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT _u IS NOT NULL AND EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_u AND role IN ('admin','manager','onboarding','tech')) $$;
CREATE FUNCTION public.seat_holder_at(_c text, _at timestamptz DEFAULT now()) RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT current_seat_holder FROM public.functional_roles WHERE code=_c $$;
`;
let db: PGlite;
const as = (u: string | null) => db.query("SELECT set_config('test.uid', $1, false)", [u ?? ""]);
const fails = async (q: string, p: unknown[] = []) => { try { await db.query(q, p); return null; } catch (e) { return (e as Error).message; } };

beforeEach(async () => {
  db = new PGlite();
  await db.exec(STUBS);
  for (const [id, name, role] of [[admin, "Ada", "admin"], [staff, "Sam Staff", "tech"], [sup, "Sue", "manager"], [owner, "Olive", "owner"], [vendor, "Vic", "vendor"], [seatHolder, "Seth", "tech"], [director, "Dee", "onboarding"], [coord, "Cora", "tech"]] as const) {
    await db.query("INSERT INTO auth.users VALUES ($1)", [id]);
    await db.query("INSERT INTO public.profiles(id, full_name, oncall_eligible) VALUES ($1,$2,true)", [id, name]);
    await db.query("INSERT INTO public.user_roles VALUES ($1,$2)", [id, role]);
  }
  await db.exec(`INSERT INTO public.functional_roles VALUES ('ops_supervisor','Supervisor',NULL,'${sup}'),('ge_day','GE day','po_day','${staff}'),('po_day','PO day',NULL,'${seatHolder}'),('onboarding_director','OD',NULL,'${director}');`);
  await db.exec(SQL);
});

describe("Remove users (isolated PostgreSQL)", () => {
  it("staff delete with no open work keeps a former record and clears access, seats and future on-call", async () => {
    await db.exec(`UPDATE public.functional_roles SET current_seat_holder='${coord}' WHERE code='ge_day';
      INSERT INTO public.oncall_roster(user_id, starts_on, ends_on) VALUES ('${staff}', current_date - 10, current_date - 10), ('${staff}', current_date + 5, current_date + 5);
      INSERT INTO public.app_settings VALUES ('oncall_weekday_pattern', '{"0":"${staff}","1":"${sup}"}');
      INSERT INTO public.staff_notifications(user_id) VALUES ('${staff}');
      INSERT INTO public.tickets(title, status, assigned_to) VALUES ('Old leak', 'closed', '${staff}');`);
    await as(admin);
    await db.query("SELECT public.remove_staff_user($1)", [staff]);
    const p = (await db.query<{ removed_at: string | null; full_name: string; oncall_eligible: boolean }>("SELECT * FROM public.profiles WHERE id=$1", [staff])).rows[0]!;
    expect(p.removed_at).not.toBeNull();
    expect(p.full_name).toBe("Sam Staff");
    expect(p.oncall_eligible).toBe(false);
    expect((await db.query("SELECT 1 FROM public.user_roles WHERE user_id=$1", [staff])).rows).toHaveLength(0);
    expect((await db.query("SELECT 1 FROM public.staff_notifications WHERE user_id=$1", [staff])).rows).toHaveLength(0);
    expect((await db.query<{ n: number }>("SELECT count(*)::int n FROM public.oncall_roster WHERE user_id=$1", [staff])).rows[0]!.n).toBe(1); // past night kept
    expect((await db.query<{ v: Record<string, string> }>("SELECT value v FROM public.app_settings")).rows[0]!.v).toEqual({ "0": "", "1": sup });
    expect((await db.query("SELECT 1 FROM public.tickets WHERE assigned_to=$1", [staff])).rows).toHaveLength(1); // history kept
    expect((await db.query<{ action: string; actor_id: string }>("SELECT action, actor_id FROM public.audit_log")).rows).toContainEqual({ action: "user.deleted", actor_id: admin });
  });

  it("history shows the name as (former)", async () => {
    expect(formerName("Sam Staff", "2026-11-04")).toBe("Sam Staff (former)");
    expect(personName([{ id: staff, full_name: "Sam Staff", email: null, removed_at: "2026-11-04" }], staff)).toBe("Sam Staff (former)");
    expect(formerName("Sue", null)).toBe("Sue");
  });

  it("delete is blocked while open work remains; Reassign all clears it, then delete succeeds", async () => {
    await db.exec(`INSERT INTO public.tickets(title, functional_role_code, assigned_to, current_action_owner) VALUES ('Leak', 'ge_day', '${staff}', '${staff}');
      INSERT INTO public.onboarding_tasks(title, assigned_to) VALUES ('Photos', '${staff}');
      INSERT INTO public.work_orders(title, assigned_to) VALUES ('Fix', '${staff}');
      INSERT INTO public.approvals(approver_id) VALUES ('${staff}');`);
    await as(admin);
    const open = (await db.query<{ kind: string }>("SELECT kind FROM public.staff_open_work($1)", [staff])).rows.map((r) => r.kind).sort();
    expect(open).toEqual(["approval", "seat", "task", "ticket", "work_order"]);
    expect(canDeleteNow(open as never)).toBe(false);
    expect(await fails("SELECT public.remove_staff_user($1)", [staff])).toContain("still owns open work");
    await db.query("SELECT public.reassign_staff_open_work($1)", [staff]);
    // ge_day seat was the leaver's own seat, so the ticket goes to the backup seat holder.
    expect((await db.query<{ a: string }>("SELECT assigned_to a FROM public.tickets")).rows[0]!.a).toBe(seatHolder);
    expect((await db.query<{ a: string }>("SELECT assigned_to a FROM public.onboarding_tasks")).rows[0]!.a).toBe(director);
    expect((await db.query<{ a: string }>("SELECT assigned_to a FROM public.work_orders")).rows[0]!.a).toBe(sup);
    expect((await db.query<{ a: string }>("SELECT approver_id a FROM public.approvals")).rows[0]!.a).toBe(sup);
    expect((await db.query("SELECT * FROM public.staff_open_work($1)", [staff])).rows).toHaveLength(0);
    await db.query("SELECT public.remove_staff_user($1)", [staff]);
  });

  it("owner archive keeps hours and records; restore reverses it", async () => {
    await db.exec(`INSERT INTO public.owner_time_entries(owner_user_id, minutes) VALUES ('${owner}', 90);`);
    await as(admin);
    await db.query("SELECT public.set_account_archived($1, true)", [owner]);
    expect((await db.query<{ a: string | null }>("SELECT archived_at a FROM public.profiles WHERE id=$1", [owner])).rows[0]!.a).not.toBeNull();
    expect((await db.query<{ m: number }>("SELECT minutes m FROM public.owner_time_entries")).rows[0]!.m).toBe(90);
    expect((await db.query("SELECT 1 FROM public.user_roles WHERE user_id=$1", [owner])).rows).toHaveLength(1);
    await db.query("SELECT public.set_account_archived($1, false)", [owner]);
    expect((await db.query<{ a: string | null }>("SELECT archived_at a FROM public.profiles WHERE id=$1", [owner])).rows[0]!.a).toBeNull();
    const acts = (await db.query<{ action: string }>("SELECT action FROM public.audit_log ORDER BY id")).rows.map((r) => r.action);
    expect(acts).toEqual(["user.archived", "user.restored"]);
  });

  it("vendor archive works the same; staff cannot be archived and owners cannot be deleted", async () => {
    await as(admin);
    await db.query("SELECT public.set_account_archived($1, true)", [vendor]);
    expect((await db.query<{ a: string | null }>("SELECT archived_at a FROM public.profiles WHERE id=$1", [vendor])).rows[0]!.a).not.toBeNull();
    expect(await fails("SELECT public.set_account_archived($1, true)", [staff])).toContain("Staff are deleted");
    expect(await fails("SELECT public.remove_staff_user($1)", [owner])).toContain("Only staff");
  });

  it("no cascade can remove protected history: deleting a sign-in account or profile fails as a whole", async () => {
    await db.exec(`INSERT INTO public.owner_time_entries(owner_user_id, minutes) VALUES ('${owner}', 30);
      INSERT INTO public.documents(uploaded_by) VALUES ('${owner}');`);
    expect(await fails("DELETE FROM auth.users WHERE id=$1", [owner])).toContain("never deleted");
    expect(await fails("DELETE FROM public.profiles WHERE id=$1", [staff])).toContain("never deleted");
    expect((await db.query("SELECT 1 FROM public.owner_time_entries")).rows).toHaveLength(1);
    expect((await db.query("SELECT 1 FROM auth.users WHERE id=$1", [owner])).rows).toHaveLength(1);
  });

  it("non-Admins cannot delete, reassign or archive; anon cannot run anything", async () => {
    await as(sup);
    expect(await fails("SELECT public.remove_staff_user($1)", [coord])).toContain("Only an Admin");
    expect(await fails("SELECT public.reassign_staff_open_work($1)", [coord])).toContain("Only an Admin");
    expect(await fails("SELECT public.set_account_archived($1, true)", [owner])).toContain("Only an Admin");
    await as(admin);
    expect(await fails("SELECT public.remove_staff_user($1)", [admin])).toContain("your own");
    const r = (await db.query<{ a: boolean; b: boolean; c: boolean }>(`SELECT has_function_privilege('anon','public.remove_staff_user(uuid)','EXECUTE') a,
      has_function_privilege('anon','public.set_account_archived(uuid,boolean)','EXECUTE') b,
      has_function_privilege('anon','public.staff_open_work(uuid)','EXECUTE') c`)).rows[0]!;
    expect(r).toEqual({ a: false, b: false, c: false });
  });

  it("undo removes the functions and the delete guard, keeping the saved columns", async () => {
    await db.exec(UNDO);
    expect((await db.query("SELECT 1 FROM pg_proc WHERE proname IN ('remove_staff_user','set_account_archived','staff_open_work','reassign_staff_open_work','block_profile_delete')")).rows).toHaveLength(0);
    expect((await db.query("SELECT 1 FROM pg_trigger WHERE tgname='profiles_never_delete'")).rows).toHaveLength(0);
    expect((await db.query("SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='removed_at'")).rows).toHaveLength(1);
  });
});

describe("Screens", () => {
  const fs = require("node:fs");
  it("every server action checks Admin first", () => {
    const src = fs.readFileSync("src/lib/user-removal.functions.ts", "utf8") as string;
    for (const fn of ["staffOpenWork", "reassignStaffOpenWork", "deleteStaffUser", "listArchivableAccounts", "setAccountArchived"]) {
      const body = src.split(`export const ${fn} =`)[1]!.split("export const ")[0]!;
      expect(body).toContain("assertAdmin(context.supabase, context.userId)");
    }
  });
  it("archive lists render only for Admins", () => {
    expect(fs.readFileSync("src/components/team/AccountArchiveList.tsx", "utf8")).toContain("if (!isAdmin) return null;");
  });
});
