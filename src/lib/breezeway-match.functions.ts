/**
 * B3: unmatched onboarding homes with suggested Breezeway homes, and the Admin's Confirm match.
 * Reads Breezeway's own property list; confirming re-checks it, sets the home's Breezeway id and
 * verified state, and records who and when. Nothing is matched automatically.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Ctx = { supabase: { rpc: (n: string, a: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }> }; userId: string };

async function assertAdmin(context: Ctx) {
  const { data, error } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (error || data !== true) throw new Error("Only an Admin can match homes to Breezeway.");
}

export type BreezewayMatchRow = {
  propertyId: string;
  address: string;
  state: string;
  suggestions: { id: number; name: string | null; address: string | null; city: string | null }[];
};

export const onboardingBreezewayMatchesFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ rows: BreezewayMatchRow[]; error: string | null }> => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("properties")
      .select("id, name, address_line1, breezeway_property_id, breezeway_mapping_state, lifecycle_status, is_demo, archived_at");
    if (error) throw new Error("Could not read the homes.");
    const all = (data ?? []) as unknown as {
      id: string; name: string | null; address_line1: string | null; breezeway_property_id: string | null;
      breezeway_mapping_state: string | null; lifecycle_status: string | null; is_demo: boolean | null; archived_at: string | null;
    }[];
    const taken = new Set(all.map((p) => (p.breezeway_property_id ?? "").trim()).filter(Boolean));
    const unmatched = all.filter(
      (p) => p.lifecycle_status === "onboarding" && !p.is_demo && !p.archived_at && p.breezeway_mapping_state !== "verified",
    );
    let homes: import("./breezeway-match").BreezewayHome[] = [];
    let listError: string | null = null;
    try {
      const { listBreezewayProperties } = await import("./breezeway.server");
      homes = (await listBreezewayProperties()).items.map((h) => ({ id: h.id, name: h.name, address: h.address, city: h.city, status: h.status }));
    } catch (e) {
      console.error("[breezeway-match] property list failed:", (e as Error).message);
      listError = "Breezeway's home list could not be read right now.";
    }
    const { suggestBreezewayHomes } = await import("./breezeway-match");
    return {
      error: listError,
      rows: unmatched.map((p) => ({
        propertyId: p.id,
        address: p.address_line1 || p.name || "Home",
        state: p.breezeway_mapping_state ?? "unmapped",
        suggestions: suggestBreezewayHomes(p.address_line1, homes, taken).map(({ id, name, address, city }) => ({ id, name, address, city })),
      })),
    };
  });

export const confirmBreezewayMatchFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ propertyId: z.string().uuid(), breezewayHomeId: z.number().int().positive() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { listBreezewayProperties } = await import("./breezeway.server");
    const home = (await listBreezewayProperties()).items.find((h) => h.id === data.breezewayHomeId);
    if (!home || (home.status ?? "").toLowerCase() !== "active") throw new Error("That Breezeway home is not active in Breezeway.");
    const holder = await supabaseAdmin.from("properties").select("id").eq("breezeway_property_id", String(home.id)).neq("id", data.propertyId).limit(1);
    if (holder.error) throw new Error("Could not check the Breezeway home.");
    if ((holder.data ?? []).length) throw new Error("Another Resolve home already uses that Breezeway home.");
    const before = await supabaseAdmin.from("properties").select("address_line1, breezeway_property_id, breezeway_mapping_state").eq("id", data.propertyId).single();
    if (before.error || !before.data) throw new Error("That home was not found.");
    const now = new Date().toISOString();
    const { error } = await supabaseAdmin
      .from("properties")
      .update({
        breezeway_property_id: String(home.id),
        breezeway_mapping_state: "verified",
        breezeway_mapping_note: `Matched by an Admin to Breezeway home ${home.id}.`,
        breezeway_mapping_verified_at: now,
      } as never)
      .eq("id", data.propertyId);
    if (error) throw new Error("The match was not saved.");
    const { writeAudit } = await import("./audit.server");
    await writeAudit({
      actorId: context.userId,
      action: "breezeway_match_confirmed",
      entityType: "property",
      entityId: data.propertyId,
      entityLabel: (before.data as { address_line1: string | null }).address_line1 ?? "Home",
      before: before.data,
      after: { breezeway_property_id: String(home.id), breezeway_mapping_state: "verified", at: now },
    });
    return { ok: true as const, breezewayHomeId: home.id };
  });
