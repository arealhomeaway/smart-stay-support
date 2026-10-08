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

type Ctx = { supabase: import("@supabase/supabase-js").SupabaseClient; userId: string };

async function isEditor({ supabase, userId }: Ctx) {
  const [dir, adm] = await Promise.all([
    supabase.rpc("is_onboarding_director", { _user_id: userId }),
    supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
  ]);
  return dir.data === true || adm.data === true;
}
async function assertEditor(ctx: Ctx) {
  if (!(await isEditor(ctx))) throw new Error("Only the Onboarding Director can edit the welcome email.");
}

export const enrollActiveOwner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      propertyId: z.string().uuid(),
      email: z.string().trim().toLowerCase().email().max(255),
      name: z.string().trim().min(2).max(120),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const ctx = context as unknown as Ctx;
    const [dir, adm, mgr] = await Promise.all([
      ctx.supabase.rpc("is_onboarding_director", { _user_id: ctx.userId }),
      ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" }),
      ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "manager" }),
    ]);
    if (dir.data !== true && adm.data !== true && mgr.data !== true)
      throw new Error("Only a supervisor or the Onboarding Director can set up an Active Owner.");
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { applyRole } = await import("./access.server");
    const { writeAudit } = await import("./audit.server");

    // Reuse an existing account for this email; create one only if none exists.
    let userId: string | null = null;
    let created = false;
    const existing = await db.from("profiles").select("id").ilike("email", data.email).maybeSingle();
    if (existing.data) {
      userId = (existing.data as { id: string }).id;
      const roles = await db.from("user_roles").select("role").eq("user_id", userId);
      const list = (roles.data ?? []).map((r) => String(r.role));
      if (list.some((r) => r !== "owner"))
        throw new Error("That email belongs to a staff account. Use the homeowner's own email.");
      if (!list.includes("owner")) await applyRole(userId, "owner");
    } else {
      const res = await db.auth.admin.createUser({
        email: data.email,
        password: crypto.randomUUID() + crypto.randomUUID(),
        email_confirm: true,
        user_metadata: { full_name: data.name },
      });
      if (res.error || !res.data.user) throw new Error("Could not create the homeowner account. Please try again.");
      userId = res.data.user.id;
      created = true;
      await applyRole(userId, "owner");
      await writeAudit({
        actorId: ctx.userId, actorLabel: null, action: "user.created_for_active_owner",
        entityType: "user", entityId: userId!, entityLabel: data.email,
        after: { role: "owner", method: "active_owner_setup", property_id: data.propertyId },
      });
    }

    // Enrollment, link, activation and welcome happen together as the staff member.
    const { data: r, error } = await ctx.supabase.rpc("enroll_active_owner" as never, {
      _property_id: data.propertyId, _owner_user_id: userId,
    } as never);
    if (error) throw new Error(error.message);
    return { ...(r as Record<string, unknown>), accountCreated: created } as {
      programId: string; alreadyEnrolled: boolean; participationOpen: boolean;
      activatedNow: boolean; welcomeQueued: boolean; accountCreated: boolean;
    };
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
    return { template: tpl, canEdit: await isEditor(ctx), recent: recent ?? [] };
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
