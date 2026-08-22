import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Demo environment control (server-side).
 *
 * The seed/reset run through the admin-only database functions. Each function
 * first verifies the caller holds the admin role (server-side), then performs
 * the isolated demo work. Demo rows are tagged is_demo so they can never be
 * mistaken for live work or reach real emails, texts or integrations.
 */

async function assertAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (error) throw new Error("Could not verify your access level.");
  if (!data) throw new Error("Only a Platform Admin can manage the demo environment.");
}


export const getDemoStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("demo_environment")
      .select("active, seeded_at, scenario_count")
      .eq("id", "default")
      .maybeSingle();
    if (error) throw error;
    return {
      active: data?.active ?? false,
      seeded: Boolean(data?.seeded_at),
      scenarioCount: data?.scenario_count ?? 0,
    };
  });

export const seedDemoEnvironment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({}).parse(data))
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("seed_demo_environment");
    if (error) throw error;
    return { ok: true as const };
  });

export const resetDemoEnvironment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({}).parse(data))
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("reset_demo_environment");
    if (error) throw error;
    return { ok: true as const };
  });
