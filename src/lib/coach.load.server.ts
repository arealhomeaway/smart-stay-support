import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export { generateGuidance, answerFollowUp } from "./coach.server";

type Client = SupabaseClient<Database>;

/** Everything the coach is allowed to reason from: the SOP catalogs plus this home. */
export async function loadCatalog(
  supabase: Client,
  opts: { propertyId: string | null; occupancyHint: string | null; guestName: string | null },
) {
  const [workTypesRes, playbooksRes] = await Promise.all([
    supabase
      .from("work_types")
      .select(
        "name, category, bucket, default_priority, response_minutes, action_start_minutes, required_closure_evidence, operating_standard",
      )

      .eq("active", true)
      .order("sort_order"),
    supabase.from("playbooks").select("title, category, summary, playbook_steps(instruction, position)").eq("active", true),
  ]);

  let property = null;
  let history: { title: string; category: string; priority: string; outcome: string | null }[] = [];

  if (opts.propertyId) {
    const [propRes, histRes] = await Promise.all([
      supabase
        .from("properties")
        .select("name, nickname, address_line1, city, state, access_notes, wifi_notes, notes")
        .eq("id", opts.propertyId)
        .maybeSingle(),
      supabase
        .from("tickets")
        .select("title, category, priority, resolution_notes")
        .eq("property_id", opts.propertyId)
        // The Coach never learns from demo or archived prelaunch records.
        .eq("is_demo", false)
        .is("archived_at", null)
        .order("created_at", { ascending: false })
        .limit(8),

    ]);
    if (propRes.data) {
      property = {
        name: propRes.data.name,
        nickname: propRes.data.nickname,
        address: [propRes.data.address_line1, propRes.data.city, propRes.data.state].filter(Boolean).join(", ") || null,
        access_notes: propRes.data.access_notes,
        wifi_notes: propRes.data.wifi_notes,
        notes: propRes.data.notes,
      };
    }
    history = (histRes.data ?? []).map((t) => ({
      title: t.title,
      category: t.category,
      priority: t.priority,
      outcome: t.resolution_notes,
    }));
  }

  return {
    workTypes: workTypesRes.data ?? [],
    playbooks: (playbooksRes.data ?? []).map((p) => ({
      title: p.title,
      category: p.category,
      summary: p.summary,
      steps: [...(p.playbook_steps ?? [])].sort((a, b) => a.position - b.position).map((s) => s.instruction),
    })),
    property,
    occupancyHint: opts.occupancyHint,
    guestName: opts.guestName,
    history,
  };
}
