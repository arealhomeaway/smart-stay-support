/**
 * Active Owner setup + welcome email, for staff.
 * - enrollActiveOwner: one action that enrolls the home, finds or creates the
 *   homeowner account (never a duplicate), links it, opens participation when a
 *   confirmed closing exists and queues one welcome.
 * - Welcome wording: the Onboarding Director (or admin) edits, versions and approves it.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { OWNER_WELCOME_KEY, readWelcomeTemplate, renderWelcome } from "./owner-welcome";
import { enrollmentInput } from "./active-owner-enrollment";

type Ctx = { supabase: import("@supabase/supabase-js").SupabaseClient; userId: string };

async function isEditor({ supabase, userId }: Ctx) {
  const [dir, adm] = await Promise.all([
    supabase.rpc("is_onboarding_director", { _user_id: userId }),
    supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
  ]);
  return dir.data === true || adm.data === true;
}
/**
 * Active Owner enrollment, welcome Retry and Reconcile: Onboarding Director
 * seat or Admin. A Supervisor (manager) role alone is not enough.
 * Same set as welcome editing today, kept as its own rule so they can diverge.
 */
export async function isActiveOwnerAuthority(ctx: Ctx) {
  const [dir, adm] = await Promise.all([
    ctx.supabase.rpc("is_onboarding_director", { _user_id: ctx.userId }),
    ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" }),
  ]);
  if (dir.error || adm.error) throw new Error("Could not verify your access level.");
  return dir.data === true || adm.data === true;
}
/**
 * Same authority, plus the demo-only rule for synthetic test accounts:
 * they may act on demo records only. Decided by DB active_owner_may_act.
 */
export async function mayActOnRecord(ctx: Ctx, isDemo: boolean) {
  const r = await ctx.supabase.rpc("active_owner_may_act" as never, { _is_demo: isDemo } as never);
  if (r.error) throw new Error("Could not verify your access level.");
  return r.data === true;
}
async function assertEditor(ctx: Ctx) {
  if (!(await isEditor(ctx))) throw new Error("Only the Onboarding Director can edit the welcome email.");
}

export const enrollActiveOwner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => enrollmentInput.parse(d))
  .handler(async ({ context, data }) => {
    const ctx = context as unknown as Ctx;
    if (!(await isActiveOwnerAuthority(ctx)))
      throw new Error("Only the Onboarding Director or an Admin can set up an Active Owner.");
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    // Check the home before any account work, so a refused caller creates nothing.
    const home = await db.from("properties").select("is_demo").eq("id", data.propertyId).maybeSingle();
    if (!home.data) throw new Error("Home not found.");
    if (!(await mayActOnRecord(ctx, (home.data as { is_demo: boolean | null }).is_demo === true)))
      throw new Error("Test accounts can only set up Active Owner on demo homes.");
    const { enrollFully } = await import("./active-owner-enrollment.server");
    return enrollFully(db, ctx.supabase, ctx.userId, data);
  });

/** Read-only prefill and account/program notice for the same enrollment window. */
export const activeOwnerEnrollmentContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ propertyId: z.string().uuid(), email: z.string().trim().email().optional() }).parse(d))
  .handler(async ({ context, data }) => {
    const ctx = context as unknown as Ctx;
    if (!(await isActiveOwnerAuthority(ctx))) throw new Error("Only the Onboarding Director or an Admin can enroll.");
    const home = await ctx.supabase.from("properties").select("owner_record_id,actual_closing_on,planned_closing_on,is_demo").eq("id", data.propertyId).single();
    if (home.error || !home.data?.owner_record_id) throw new Error("Link this home to its homeowner record before enrolling.");
    if (!(await mayActOnRecord(ctx, home.data.is_demo === true))) throw new Error("Test accounts can only enroll practice homes.");
    const owner = await ctx.supabase.from("property_owners").select("id,name,email,active").eq("id", home.data.owner_record_id).single();
    if (owner.error || !owner.data?.active) throw new Error("This homeowner record needs to be active before enrollment.");
    const programs = await ctx.supabase.from("owner_programs").select("id,status,onboarding_lead,operations_lead,internal_notes")
      .eq("owner_record_id", owner.data.id).eq("is_demo", home.data.is_demo).is("archived_at", null).not("status", "in", "(closed,completed,complete)");
    if (programs.error) throw new Error("Could not check existing enrollment.");
    if ((programs.data?.length ?? 0) > 1) throw new Error("This homeowner has conflicting programs. Review them before enrollment.");
    const choices = await ctx.supabase.rpc("owner_program_staff_choices");
    if (choices.error) throw new Error("Could not load available leads.");
    const profile = await ctx.supabase.from("profiles").select("id").ilike("email", data.email ?? owner.data.email ?? "").maybeSingle();
    if (profile.error) throw new Error("Could not check the homeowner login.");
    return { owner: owner.data, actualClosing: home.data.actual_closing_on as string | null,
      closingDate: (home.data.actual_closing_on ?? home.data.planned_closing_on) as string | null,
      program: programs.data?.[0] ?? null, accountExists: Boolean(profile.data),
      staffChoices: (choices.data ?? []) as { id: string; label: string }[] };
  });

export const getWelcomeAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as unknown as Ctx;
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { loadWelcomeTemplate } = await import("./owner-welcome.server");
    const tpl = await loadWelcomeTemplate(db);
    const { data: recent } = await ctx.supabase
      .from("owner_welcome_messages")
      .select("id, recipient, status, queued_at, sent_at, error_message, is_demo, template_version, program_id")
      .order("queued_at", { ascending: false })
      .limit(25);
    const canEdit = await isEditor(ctx);
    const canManageDelivery = await isActiveOwnerAuthority(ctx);
    return { template: tpl, canEdit, canManageDelivery, recent: recent ?? [] };
  });

export const saveWelcomeTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      subject: z.string().trim().min(3).max(200),
      body: z.string().min(20).max(20000),
      video: z.union([
        z.object({ kind: z.literal("link"), url: z.string().url().startsWith("https://").max(2000) }),
        z.object({ kind: z.literal("upload"), path: z.string().min(3).max(300), name: z.string().max(200) }),
        z.null(),
      ]),
      review: z.enum(["draft", "approved"]),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const ctx = context as unknown as Ctx;
    await assertEditor(ctx);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { loadWelcomeTemplate } = await import("./owner-welcome.server");
    const { writeAudit } = await import("./audit.server");
    const before = await loadWelcomeTemplate(db);
    const next = readWelcomeTemplate({ ...data, version: before.version + 1 });
    const { error } = await db.from("app_settings").upsert({ key: OWNER_WELCOME_KEY, value: next as never, updated_by: ctx.userId } as never, { onConflict: "key" });
    if (error) throw new Error("Could not save the welcome email.");
    await writeAudit({
      actorId: ctx.userId, actorLabel: null, action: "owner_welcome.template_saved",
      entityType: "app_setting", entityId: null, entityLabel: OWNER_WELCOME_KEY,
      before: before as never, after: next as never,
    });
    return next;
  });

/** Signed one-time upload slot in the private welcome-media store. */
export const welcomeVideoUploadSlot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ name: z.string().min(1).max(200), size: z.number().int().positive().max(250 * 1024 * 1024) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertEditor(context as unknown as Ctx);
    if (!/\.(mp4|mov|m4v|webm)$/i.test(data.name)) throw new Error("Upload an MP4, MOV, M4V or WebM video.");
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const path = `welcome/${crypto.randomUUID()}-${data.name.replace(/[^\w.-]+/g, "_")}`;
    const { data: slot, error } = await db.storage.from("owner-welcome-media").createSignedUploadUrl(path);
    if (error || !slot) throw new Error("Could not prepare the upload.");
    return { path, token: slot.token };
  });

/** Preview with sample values, exactly as a homeowner would see it. */
export const previewWelcome = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ subject: z.string().max(200), body: z.string().max(20000), hasVideo: z.boolean(), videoUrl: z.string().nullable() }).parse(d))
  .handler(async ({ data }) => {
    const { PORTAL_LINK, WELCOME_VIDEO_LINK } = await import("./owner-welcome.server");
    return renderWelcome(data, {
      ownerName: "Matthew Sample",
      propertyNames: ["1399 Sample Lane"],
      portalLink: PORTAL_LINK,
      videoLink: data.hasVideo ? (data.videoUrl ?? WELCOME_VIDEO_LINK) : null,
    });
  });

/** Signed-in homeowners (and staff) watch the uploaded welcome video. */
export const welcomeVideoUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { loadWelcomeTemplate } = await import("./owner-welcome.server");
    const tpl = await loadWelcomeTemplate(db);
    if (!tpl.video) return { url: null };
    if (tpl.video.kind === "link") return { url: tpl.video.url };
    const { data } = await db.storage.from("owner-welcome-media").createSignedUrl(tpl.video.path, 60 * 60);
    return { url: data?.signedUrl ?? null };
  });

/** Onboarding Director / Admin: put a failed welcome back in the queue. */
export const retryWelcome = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const ctx = context as unknown as Ctx;
    if (!(await isActiveOwnerAuthority(ctx)))
      throw new Error("Only the Onboarding Director or an Admin can retry a welcome.");
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { retryOwnerWelcome } = await import("./owner-welcome.server");
    const { writeAudit } = await import("./audit.server");
    const row = await db.from("owner_welcome_messages").select("is_demo").eq("id", data.id).maybeSingle();
    if (!row.data) throw new Error("Welcome not found.");
    if (!(await mayActOnRecord(ctx, (row.data as { is_demo: boolean | null }).is_demo === true)))
      throw new Error("Test accounts cannot retry real welcome deliveries.");
    const r = await retryOwnerWelcome(db, data.id);
    if (r.requeued) await writeAudit({ actorId: ctx.userId, actorLabel: null, action: "owner_welcome.retry", entityType: "owner_welcome_message", entityId: data.id, entityLabel: null });
    return r;
  });


/** Reconciliation is authorized and audited atomically in the database. */
export const reconcileWelcome = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    id: z.string().uuid(),
    outcome: z.enum(["delivered", "not_delivered"]),
    reason: z.string().trim().min(5).max(1000),
  }).parse(d))
  .handler(async ({ context, data }) => {
    const ctx = context as unknown as Ctx;
    if (!(await isActiveOwnerAuthority(ctx)))
      throw new Error("Only the Onboarding Director or an Admin can reconcile a welcome.");
    const { data: result, error } = await ctx.supabase.rpc("reconcile_owner_welcome" as never, {
      _id: data.id, _outcome: data.outcome, _reason: data.reason,
    } as never);
    if (error) throw new Error(error.message);
    return result;
  });
