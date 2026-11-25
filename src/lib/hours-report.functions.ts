/**
 * Weekly hours report (Nov 25): Admin settings and preview on Owner programs, and the Owner tab line,
 * Preview, Hold this week and test copy. Test copies go only to the signed-in staff member.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const uuid = z.string().uuid();
const NOT_YET = "This starts once the Admin approves the database change.";
const settingsSchema = z.object({
  enabled: z.boolean(),
  day: z.number().int().min(1).max(5),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  subject: z.string().trim().min(1).max(200),
  opening: z.string().trim().min(1).max(2000),
  closing: z.string().trim().min(1).max(2000),
});

function staged(e: { message?: string; code?: string } | null | undefined): never {
  if (e && (e.code === "42883" || e.code === "PGRST202" || /does not exist|could not find/i.test(e.message ?? ""))) throw new Error(NOT_YET);
  throw new Error(e?.message ?? "Something went wrong. Please try again.");
}

async function isRole(sb: unknown, uid: string, role: string) {
  const r = await (sb as { rpc: (n: string, a: unknown) => Promise<{ data: unknown }> }).rpc("has_role", { _user_id: uid, _role: role });
  return r.data === true;
}
async function requireStaff(sb: unknown, uid: string) {
  const r = await (sb as { rpc: (n: string, a: unknown) => Promise<{ data: unknown }> }).rpc("is_staff", { _user_id: uid });
  if (r.data !== true) throw new Error("Only staff can use the hours report.");
}

export const readHoursReportAdminFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const m = await import("@/lib/hours-report.server");
    const settings = await m.loadHoursReportSettings(supabaseAdmin);
    const edits = await (context.supabase as unknown as { from: (t: string) => any }).from("ao_hours_report_edits")
      .select("edited_by, edited_at").order("edited_at", { ascending: false }).limit(5);
    const ids = [...new Set(((edits.data ?? []) as { edited_by: string }[]).map((e) => e.edited_by))];
    const prof = ids.length ? await supabaseAdmin.from("profiles").select("id, full_name, email").in("id", ids) : { data: [] };
    const nm = new Map(((prof.data ?? []) as { id: string; full_name: string | null; email: string | null }[]).map((p) => [p.id, p.full_name || p.email || "A teammate"]));
    return {
      settings,
      isAdmin: await isRole(context.supabase, context.userId, "admin"),
      edits: ((edits.data ?? []) as { edited_by: string; edited_at: string }[]).map((e) => ({ who: nm.get(e.edited_by) ?? "A teammate", at: e.edited_at })),
    };
  });

export const saveHoursReportSettingsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => settingsSchema.parse(d))
  .handler(async ({ context, data }) => {
    const r = await context.supabase.rpc("save_ao_hours_report_settings" as never, { _value: data } as never);
    if (r.error) staged(r.error);
    return { ok: true as const };
  });

/** Preview with a real program's numbers; unsaved Admin wording may be passed in. */
export const previewHoursReportFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ programId: uuid.optional(), propertyId: uuid.optional(), draft: settingsSchema.optional() }).parse(d))
  .handler(async ({ context, data }) => {
    await requireStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const m = await import("@/lib/hours-report.server");
    const { readHoursReportSettings } = await import("@/lib/hours-report");
    const settings = data.draft ? readHoursReportSettings(data.draft) : await m.loadHoursReportSettings(supabaseAdmin);
    let programId = data.programId ?? null;
    if (!programId && data.propertyId) programId = (await m.programForHome(supabaseAdmin, data.propertyId))?.id ?? null;
    if (!programId) {
      const any = await supabaseAdmin.from("owner_programs").select("id").eq("is_demo", false).not("status", "in", "(closed,archived)").is("archived_at", null).order("created_at").limit(1).maybeSingle();
      programId = (any.data as { id: string } | null)?.id ?? null;
    }
    if (!programId) throw new Error("No live program to preview.");
    const r = await m.buildProgramReport(supabaseAdmin, programId, settings);
    return { subject: r.subject, body: r.body };
  });

export const sendHoursReportTestFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ programId: uuid.optional(), propertyId: uuid.optional(), draft: settingsSchema.optional() }).parse(d))
  .handler(async ({ context, data }) => {
    await requireStaff(context.supabase, context.userId);
    if (data.draft && !(await isRole(context.supabase, context.userId, "admin"))) throw new Error("Only an Admin can test unsaved wording.");
    const email = (context.claims as { email?: string } | undefined)?.email;
    if (!email) throw new Error("Your account has no email address.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const m = await import("@/lib/hours-report.server");
    const { readHoursReportSettings } = await import("@/lib/hours-report");
    let programId = data.programId ?? null;
    if (!programId && data.propertyId) programId = (await m.programForHome(supabaseAdmin, data.propertyId))?.id ?? null;
    if (!programId) {
      const any = await supabaseAdmin.from("owner_programs").select("id").eq("is_demo", false).not("status", "in", "(closed,archived)").is("archived_at", null).order("created_at").limit(1).maybeSingle();
      programId = (any.data as { id: string } | null)?.id ?? null;
    }
    if (!programId) throw new Error("No live program to use.");
    return m.sendHoursReportTestCopy(supabaseAdmin, email, programId, data.draft ? readHoursReportSettings(data.draft) : undefined);
  });

export const hoursReportLineFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ propertyId: uuid }).parse(d))
  .handler(async ({ context, data }) => {
    await requireStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const m = await import("@/lib/hours-report.server");
    return m.hoursReportLine(supabaseAdmin, data.propertyId);
  });

export const holdHoursReportFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ propertyId: uuid, weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).parse(d))
  .handler(async ({ context, data }) => {
    const r = await context.supabase.rpc("hold_ao_hours_report" as never, { _property_id: data.propertyId, _week_start: data.weekStart } as never);
    if (r.error) staged(r.error);
    return r.data as unknown as { ok: true; already: boolean };
  });
