import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { PropertyDeleteCheck } from "./property-delete";
import { z } from "zod";

type Rpc = { rpc: (name: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }> };
async function allowed(db: Rpc, userId: string) {
  const admin = await db.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (admin.error) throw new Error("Your access could not be checked.");
  if (admin.data === true) return true;
  const results = await Promise.all([db.rpc("is_director", { _user_id: userId }), db.rpc("is_onboarding_director", { _user_id: userId })]);
  if (results.some((r) => r.error)) throw new Error("Your access could not be checked.");
  return results.some((r) => r.data === true);
}
const home = z.object({ propertyId: z.string().uuid() });
export const propertyDeleteAccessFn = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(home).handler(async ({ data, context }) => {
  if (!await allowed(context.supabase as unknown as Rpc, context.userId)) return { allowed: false };
  const [property, projects] = await Promise.all([
    context.supabase.from("properties").select("lifecycle_status,handoff_accepted_at").eq("id", data.propertyId).maybeSingle(),
    context.supabase.from("onboarding_projects").select("handoff_state,ops_accepted_at").eq("property_id", data.propertyId),
  ]);
  if (property.error || projects.error) throw new Error("This home's stage could not be checked.");
  return { allowed: property.data?.lifecycle_status === "onboarding" && !property.data.handoff_accepted_at && !(projects.data ?? []).some((p) => p.ops_accepted_at || ["ready", "ready_for_ops", "handoff_requested", "accepted", "ops_accepted"].includes(p.handoff_state ?? "")) };
});
export const checkPropertyDeleteFn = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(home).handler(async ({ data, context }) => {
  const db = context.supabase as unknown as Rpc;
  if (!await allowed(db, context.userId)) throw new Error("Only Admin and the Directors can delete an onboarding home.");
  const result = await db.rpc("check_onboarding_property_delete", { _property_id: data.propertyId });
  if (result.error) throw new Error("Deletion checks are not available yet. Nothing has been removed.");
  const checked = z.object({ allowed: z.boolean(), address: z.string(), reasons: z.array(z.string()), counts: z.record(z.string(), z.number()) }).parse(result.data);
  return checked satisfies PropertyDeleteCheck;
});
export const deletePropertyFn = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(home.extend({ address: z.string().trim().min(1), reason: z.string().trim().min(1) })).handler(async ({ data, context }) => {
  const db = context.supabase as unknown as Rpc;
  if (!await allowed(db, context.userId)) throw new Error("Only Admin and the Directors can delete an onboarding home.");
  const checked = await db.rpc("check_onboarding_property_delete", { _property_id: data.propertyId });
  if (checked.error) throw new Error("Deletion is not available yet. Nothing has been removed.");
  const result = await db.rpc("delete_onboarding_property", { _property_id: data.propertyId, _address: data.address, _reason: data.reason });
  if (result.error) throw new Error(result.error.message);
  return z.object({ auditId: z.string().uuid(), removed: z.record(z.string(), z.number()) }).parse(result.data);
});
