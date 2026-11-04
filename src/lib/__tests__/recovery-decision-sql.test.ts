import { beforeAll, describe, expect, it } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { canDecideApproval, decisionReasonMissing } from "@/lib/guest-recovery";

/** Isolated PostgreSQL check of docs/pending/refund-authority/03. Never touches the real database. */
const DIR = "docs/pending/refund-authority";
const read = (f: string) => readFileSync(`${DIR}/${f}`, "utf8");
const SUP = "00000000-0000-0000-0000-00000000000a";
const DIR_U = "00000000-0000-0000-0000-00000000000b";
const ADMIN = "00000000-0000-0000-0000-00000000000c";
const PC = "00000000-0000-0000-0000-00000000000d";
let db: PGlite;

const SETUP = `
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE SCHEMA auth;
CREATE TABLE public.me(uid uuid);
INSERT INTO public.me VALUES (NULL);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT uid FROM public.me $$;
CREATE FUNCTION public.is_supervisor(u uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT u IN ('${SUP}'::uuid,'${ADMIN}'::uuid) $$;
CREATE FUNCTION public.is_director(u uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT u IN ('${DIR_U}'::uuid,'${ADMIN}'::uuid) $$;
CREATE TABLE public.notices(user_id uuid, kind text, title text, email boolean);
CREATE FUNCTION public.notify_staff(_user_id uuid, _kind text, _title text, _body text, _entity_type text, _entity_id uuid, _link_path text, _priority text, _actor_id uuid, _email boolean, _is_demo boolean)
RETURNS void LANGUAGE sql AS $$ INSERT INTO public.notices VALUES (_user_id, _kind, _title, _email) $$;
CREATE TABLE public.guest_recovery(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text,
  stage text NOT NULL DEFAULT 'awaiting_approval',
  recovery_action text, proposed_amount numeric, approved_amount numeric, delivered_amount numeric,
  within_airbnb_policy boolean, escalation_flags text[] NOT NULL DEFAULT '{}',
  authority_level text, approval_authority text, approval_status text NOT NULL DEFAULT 'not_required',
  decision_reason text, outcome text, approved_by uuid, approved_at timestamptz,
  decision_note text, decision_at timestamptz, requested_by uuid, created_by uuid, is_demo boolean DEFAULT false);
CREATE TABLE public.guest_recovery_activity(recovery_id uuid, author_id uuid, event_type text, body text, detail jsonb, is_demo boolean);
`;

const as = (u: string | null) => db.query("UPDATE public.me SET uid = $1", [u]);
async function pending(amount: number, level: "supervisor" | "director", action = "partial_refund") {
  const r = await db.query<{ id: string }>(
    `INSERT INTO public.guest_recovery(title, recovery_action, proposed_amount, approval_status, approval_authority, decision_reason, requested_by, within_airbnb_policy)
     VALUES ('Leak', $1, $2, 'pending', $3, 'Guest lost a night', $4, true) RETURNING id`,
    [action, amount, level, PC],
  );
  return r.rows[0]!.id;
}
const decide = (id: string, d: string, reason: string | null, amount: number | null = null) =>
  db.query("SELECT public.decide_recovery_approval($1,$2,$3,$4)", [id, d, amount, reason]);
async function err(fn: () => Promise<unknown>) {
  try { await fn(); return ""; } catch (e) { return (e as Error).message; }
}
const row = async (id: string) => (await db.query<Record<string, unknown>>("SELECT * FROM public.guest_recovery WHERE id=$1", [id])).rows[0]!;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SETUP);
  await db.exec(read("01_refund_authority_guard.sql"));
  await db.exec(read("03_recovery_approval_decision.sql"));
});

describe("Refund Approve and Decline (isolated PostgreSQL)", () => {
  it("Supervisor level: Supervisor, Director and Admin may approve; a coordinator may not", async () => {
    for (const u of [SUP, DIR_U, ADMIN]) {
      const id = await pending(800, "supervisor");
      await as(u);
      await decide(id, "approve", "Fair for one night");
      const r = await row(id);
      expect(r.approval_status).toBe("approved");
      expect(r.approved_by).toBe(u);
      expect(r.approved_at).not.toBeNull();
      expect(r.approval_authority).toBe("supervisor");
      expect(Number(r.approved_amount)).toBe(800);
      expect(r.decision_note).toBe("Fair for one night");
    }
    const id = await pending(800, "supervisor");
    await as(PC);
    expect(await err(() => decide(id, "approve", "ok"))).toContain("Only the Operations Supervisor");
    expect((await row(id)).approval_status).toBe("pending");
  });

  it("Director level: only Director or Admin; the Supervisor is rejected", async () => {
    const id = await pending(2000, "director");
    await as(SUP);
    expect(await err(() => decide(id, "approve", "ok"))).toContain("Only the Director");
    await as(DIR_U);
    await decide(id, "approve", "Relocation cost justified");
    expect((await row(id)).approval_status).toBe("approved");
    const id2 = await pending(2000, "director");
    await as(ADMIN);
    await decide(id2, "decline", "Too high");
    expect((await row(id2)).approval_status).toBe("declined");
  });

  it("a reason is required for Approve and Decline", async () => {
    const id = await pending(700, "supervisor");
    await as(SUP);
    expect(await err(() => decide(id, "approve", "  "))).toContain("Add a reason");
    expect(await err(() => decide(id, "decline", null))).toContain("Add a reason");
    expect(decisionReasonMissing(" ")).toBe(true);
  });

  it("Decline records who, when, level and reason, sets declined, and notifies the requester in-app only", async () => {
    await db.exec("DELETE FROM public.notices");
    const id = await pending(900, "supervisor");
    await as(SUP);
    await decide(id, "decline", "Offer a credit instead");
    const r = await row(id);
    expect(r.approval_status).toBe("declined");
    expect(r.approved_by).toBe(SUP);
    expect(r.approved_amount).toBeNull();
    expect(r.decision_note).toBe("Offer a credit instead");
    const n = (await db.query<{ user_id: string; email: boolean; title: string }>("SELECT * FROM public.notices")).rows;
    expect(n).toHaveLength(1);
    expect(n[0]!.user_id).toBe(PC);
    expect(n[0]!.email).toBe(false);
    expect(n[0]!.title).toBe("Refund declined");
    const a = (await db.query("SELECT * FROM public.guest_recovery_activity WHERE recovery_id=$1", [id])).rows;
    expect(a).toHaveLength(1);
  });

  it("a Supervisor cannot approve a higher amount that needs the Director", async () => {
    const id = await pending(1000, "supervisor");
    await as(SUP);
    expect(await err(() => decide(id, "approve", "ok", 1500.01))).toContain("needs Director approval");
    await decide(id, "approve", "ok", 1500);
    expect(Number((await row(id)).approved_amount)).toBe(1500);
  });

  it("a direct table update cannot mark a refund approved or declined", async () => {
    const id = await pending(800, "supervisor");
    expect(await err(() => db.query("UPDATE public.guest_recovery SET approval_status='approved' WHERE id=$1", [id]))).toContain("Use Approve or Decline");
    expect(await err(() => db.query("UPDATE public.guest_recovery SET approval_status='declined' WHERE id=$1", [id]))).toContain("Use Approve or Decline");
  });

  it("only refunds waiting for approval can be decided, and signed-out callers are refused", async () => {
    const id = await pending(800, "supervisor");
    await as(null);
    expect(await err(() => decide(id, "approve", "ok"))).toContain("Sign in");
    await as(SUP);
    await decide(id, "approve", "ok");
    expect(await err(() => decide(id, "decline", "again"))).toContain("not waiting");
  });

  it("no anonymous or PUBLIC execute; undo removes everything", async () => {
    const acl = (await db.query<{ a: string }>("SELECT proacl::text a FROM pg_proc WHERE proname='decide_recovery_approval'")).rows[0]!.a;
    expect(acl).not.toMatch(/(^|[{,])=X/);
    expect(acl).not.toContain("anon=");
    await db.exec(read("03_undo_recovery_approval_decision.sql"));
    expect((await db.query("SELECT 1 FROM pg_proc WHERE proname IN ('decide_recovery_approval','guard_recovery_decision')")).rows).toHaveLength(0);
    await db.exec(read("03_recovery_approval_decision.sql"));
  });

  it("screen rule matches: who sees Approve and Decline", () => {
    const pc = { isSupervisor: false, isDirector: false };
    const sup = { isSupervisor: true, isDirector: false };
    const dir = { isSupervisor: false, isDirector: true };
    expect(canDecideApproval("supervisor", pc)).toBe(false);
    expect(canDecideApproval("supervisor", sup)).toBe(true);
    expect(canDecideApproval("supervisor", dir)).toBe(true);
    expect(canDecideApproval("director", sup)).toBe(false);
    expect(canDecideApproval("director", dir)).toBe(true);
    expect(canDecideApproval("director", { ...pc, isAdmin: true })).toBe(true);
  });
});
