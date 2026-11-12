import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { formatPropertyLabel, matchesPropertySearch } from "@/lib/property-label";
import {
  ONBOARDING_SEARCH_LIMIT,
  onboardingTaskVisibility,
  type OnboardingTaskHit,
  type SearchableTask,
} from "@/lib/onboarding-search";

type Loose = {
  from: (t: string) => any; // eslint-disable-line @typescript-eslint/no-explicit-any
};

/** Search Resolve: onboarding Tasks by title or home name, under the onboarding workspace's view rule. */
export const searchOnboardingTasksFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ term: z.string().trim().min(2).max(80) }).parse(d))
  .handler(async ({ context, data }): Promise<{ hits: OnboardingTaskHit[] }> => {
    const db = context.supabase as unknown as Loose;
    const supabase = context.supabase;
    const { onboardingWorkspaceMode } = await import("@/lib/onboarding-workspace-view");
    const { hasOnboardingReview } = await import("@/lib/onboarding-review-capabilities");
    const { readOnboardingReviewCapabilities } = await import("@/lib/onboarding-review-access.server");
    const [leader, projects] = await Promise.all([
      supabase.rpc("is_onboarding_leader", { _user_id: context.userId }),
      db
        .from("onboarding_projects")
        .select("property_id, project_manager, director, status, properties!inner(name, nickname, listing_alias, address_line1, unit, city, state, postal_code, ownerrez_property_id)")
        .neq("status", "cancelled")
        .limit(2000),
    ]);
    if (leader.error || projects.error) return { hits: [] };
    const caps = await readOnboardingReviewCapabilities(supabase as never).catch(() => null);
    if (!caps) return { hits: [] };
    type P = { property_id: string; project_manager: string | null; director: string | null; status: string; properties: Parameters<typeof formatPropertyLabel>[0] };
    const rows = (projects.data ?? []) as P[];
    const mode = onboardingWorkspaceMode(context.userId, Boolean(leader.data) || hasOnboardingReview(caps), rows);
    const managed = new Set(
      rows.filter((p) => p.project_manager === context.userId || p.director === context.userId).map((p) => p.property_id),
    );
    const names = new Map(rows.map((p) => [p.property_id, formatPropertyLabel(p.properties).primary as string]));
    const homeMatches = rows.filter((p) => matchesPropertySearch(p.properties as never, data.term)).map((p) => p.property_id);
    const cols = "id, title, property_id, assigned_to";
    const escaped = data.term.replace(/[\\%_]/g, (c) => `\\${c}`);
    const [byTitle, byHome] = await Promise.all([
      db.from("onboarding_tasks").select(cols).is("archived_at", null).ilike("title", `%${escaped}%`).order("title").limit(200),
      homeMatches.length
        ? db.from("onboarding_tasks").select(cols).is("archived_at", null).in("property_id", homeMatches.slice(0, 50)).order("title").limit(200)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (byTitle.error || byHome.error) return { hits: [] };
    const seen = new Set<string>();
    const hits: OnboardingTaskHit[] = [];
    for (const t of [...(byTitle.data ?? []), ...(byHome.data ?? [])] as SearchableTask[]) {
      if (seen.has(t.id) || !names.has(t.property_id)) continue;
      seen.add(t.id);
      const opensIn = onboardingTaskVisibility(mode, context.userId, managed, t);
      if (!opensIn) continue;
      hits.push({ id: t.id, title: t.title, propertyId: t.property_id, homeName: names.get(t.property_id)!, opensIn });
      if (hits.length >= ONBOARDING_SEARCH_LIMIT) break;
    }
    return { hits };
  });
