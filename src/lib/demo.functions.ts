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
    // The control row can be missing (or stale) while demo scenarios exist.
    // What matters to the person previewing is whether there is demo work to
    // open, so fall back to counting the demo tickets themselves.
    const { count } = await context.supabase
      .from("tickets")
      .select("id", { count: "exact", head: true })
      .eq("is_demo", true);
    const demoTickets = count ?? 0;
    return {
      active: data?.active ?? demoTickets > 0,
      seeded: Boolean(data?.seeded_at) || demoTickets > 0,
      scenarioCount: data?.scenario_count ?? demoTickets,
    };
  });

export const seedDemoEnvironment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({}).parse(data))
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("seed_demo_environment", {
      _actor: context.userId,
    });
    if (error) throw error;
    // Stage 2: the onboarding scenario is part of the same admin-triggered seed.
    const { error: onboardingError } = await supabaseAdmin.rpc("seed_demo_onboarding", {
      _actor: context.userId,
    });
    if (onboardingError) throw onboardingError;
    // Stage 3: the isolated Active Owner scenario rides along with the same
    // deliberate admin trigger.
    const { error: ownerError } = await supabaseAdmin.rpc("seed_demo_owner_program", {
      _actor: context.userId,
    });
    if (ownerError) throw ownerError;
    return { ok: true as const };
  });

/**
 * Archives (never deletes) the demo records so the scenarios can be re-run
 * with a clean slate while the history stays auditable.
 */
export const resetDemoEnvironment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({}).parse(data))
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("reset_demo_environment", {
      _actor: context.userId,
    });
    if (error) throw error;
    const { error: onboardingError } = await supabaseAdmin.rpc("archive_demo_onboarding", {
      _actor: context.userId,
    });
    if (onboardingError) throw onboardingError;
    const { error: ownerError } = await supabaseAdmin.rpc("archive_demo_owner_program", {
      _actor: context.userId,
    });
    if (ownerError) throw ownerError;
    return { ok: true as const };
  });
