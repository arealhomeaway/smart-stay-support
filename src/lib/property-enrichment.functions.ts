import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Supervisor-triggered enrichment of the Property Hub from OwnerRez:
 * primary photo, hard property facts and the de-duplicated owner record.
 *
 * Read-only against OwnerRez. Property identity (name/address) is never
 * rewritten here, and every written field lands in `property_field_provenance`.
 */

export type EnrichmentResult = {
  ok: boolean;
  message: string;
  counts?: {
    audited: number;
    matched: number;
    updated: number;
    unmatched: number;
    photos: number;
    photosMissing: number;
    ownersLinked: number;
    ownerRecords: number;
    ownersMissing: number;
    conflicts: number;
  };
  conflicts?: { property: string; field: string; detail: string }[];
};

async function isSupervisor(
  supabase: {
    from: (t: string) => {
      select: (c: string) => {
        eq: (a: string, b: string) => Promise<{ data: { role: string }[] | null }>;
      };
    };
  },
  userId: string,
) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const roles = (data ?? []).map((r) => r.role);
  return roles.includes("admin") || roles.includes("manager");
}

export const syncPropertyEnrichment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<EnrichmentResult> => {
    const { supabase, userId } = context;
    if (!(await isSupervisor(supabase as never, userId))) {
      return {
        ok: false,
        message: "Only supervisors and administrators can refresh property information.",
      };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { runPropertyEnrichment } = await import("@/lib/property-enrichment-run.server");
    return runPropertyEnrichment(supabaseAdmin);
  });
