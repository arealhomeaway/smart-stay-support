import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type MyOwnerAnswer = {
  id: string;
  propertyId: string;
  home: string;
  title: string;
  answer: string;
  submittedAt: string;
  link: string;
};

/**
 * Homeowner card answers routed to the signed-in teammate (Project Manager in onboarding, Active
 * Owner follow-up role after handoff), last 14 days, until marked reviewed. Read only, in-app only.
 */
export const myOwnerAnswers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ demo: z.boolean().default(false) }).parse(d ?? {}))
  .handler(async ({ context, data }) => {
    const { answerRecipient, answerText, ANSWER_DAYS } = await import("./owner-answers");
    const { formatPropertyLabel } = await import("./property-label");
    const db = context.supabase as never as import("@supabase/supabase-js").SupabaseClient;
    const since = new Date(Date.now() - ANSWER_DAYS * 86_400_000).toISOString();
    const subs = await db
      .from("ao_contributions")
      .select("id, plan_card_id, property_id, program_id, card_id, field_values, submitted_at")
      .gte("submitted_at", since)
      .order("submitted_at", { ascending: false })
      .limit(500);
    if (subs.error) throw new Error("Homeowner answers could not be loaded.");
    const rows = (subs.data ?? []) as { id: string; plan_card_id: string; property_id: string; program_id: string; card_id: string; field_values: unknown; submitted_at: string }[];
    if (rows.length === 0) return [] as MyOwnerAnswer[];
    const homeIds = [...new Set(rows.map((r) => r.property_id))];
    const [programs, projects, props, cards, reviews, seat, cover, director] = await Promise.all([
      db.from("owner_programs").select("id, is_demo, archived_at").in("id", [...new Set(rows.map((r) => r.program_id))]),
      db.from("onboarding_projects").select("property_id, project_manager, director, ops_accepted_at, status, created_at").in("property_id", homeIds).order("created_at", { ascending: false }),
      db.from("properties").select("id, name, nickname, address_line1, unit, city, state, postal_code").in("id", homeIds),
      db.from("ao_library_cards").select("id, title").in("id", [...new Set(rows.map((r) => r.card_id))]),
      db.from("homeowner_answer_reviews").select("item_key, answer_at").in("property_id", homeIds),
      db.rpc("seat_holder", { _code: "active_owner_followup" }),
      db.rpc("seat_override_at", { _role_code: "active_owner_followup", _at: new Date().toISOString() }),
      db.rpc("seat_holder", { _code: "director_onboarding" }),
    ]);
    for (const r of [programs, projects, props, cards]) if (r.error) throw new Error("Homeowner answers could not be loaded.");
    const live = new Set(((programs.data ?? []) as { id: string; is_demo: boolean | null; archived_at: string | null }[])
      .filter((p) => !p.archived_at && Boolean(p.is_demo) === data.demo).map((p) => p.id));
    const projectOf = new Map<string, { project_manager: string | null; director: string | null; ops_accepted_at: string | null; status: string }>();
    for (const p of (projects.data ?? []) as { property_id: string; project_manager: string | null; director: string | null; ops_accepted_at: string | null; status: string }[]) {
      if (p.status === "cancelled" || projectOf.has(p.property_id)) continue;
      projectOf.set(p.property_id, p);
    }
    const seatInfo = {
      holder: (seat.data as string | null) ?? null,
      cover: (((cover.data ?? []) as { kind: string; user_id: string }[]).find((o) => o.kind === "cover")?.user_id) ?? null,
      onboardingDirector: (director.data as string | null) ?? null,
    };
    const homeName = new Map(((props.data ?? []) as { id: string }[]).map((p) => [p.id, formatPropertyLabel(p as never).primary]));
    const title = new Map(((cards.data ?? []) as { id: string; title: string }[]).map((c) => [c.id, c.title]));
    const reviewed = ((reviews.error ? [] : reviews.data ?? []) as { item_key: string; answer_at: string }[]);
    const out: MyOwnerAnswer[] = [];
    const seen = new Set<string>();
    for (const r of rows) {
      if (!live.has(r.program_id) || seen.has(r.plan_card_id)) continue;
      seen.add(r.plan_card_id);
      if (answerRecipient({ propertyId: r.property_id, project: projectOf.get(r.property_id) ?? null }, seatInfo) !== context.userId) continue;
      const key = `card:${r.plan_card_id}`;
      if (reviewed.some((x) => x.item_key === key && Date.parse(x.answer_at) >= Date.parse(r.submitted_at))) continue;
      out.push({
        id: r.id,
        propertyId: r.property_id,
        home: homeName.get(r.property_id) ?? "Home",
        title: title.get(r.card_id) ?? "Homeowner card",
        answer: answerText(r.field_values),
        submittedAt: r.submitted_at,
        link: `/property/${r.property_id}?tab=owner`,
      });
    }
    return out;
  });
