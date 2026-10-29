/**
 * Read-only CSV exports of a home's onboarding plan and of a reusable
 * template. Reads run as the signed-in person, so existing access applies.
 * Nothing is written, created, sent to Breezeway or published.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PLAN_HEADER, orderPlan, planRow, toCsv } from "@/lib/plan-csv";
import { conditionToCsv, readCondition } from "@/lib/plan-rules";

type Opp = { title?: string; what?: string; why?: string; how?: string } | null;

export const exportProjectPlanCsv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ propertyId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const sb = context.supabase;
    const [home, tasks] = await Promise.all([
      sb.from("properties").select("name, nickname, address_line1, unit, city, state, postal_code, ownerrez_property_id").eq("id", data.propertyId).maybeSingle(),
      sb.from("onboarding_tasks")
        .select("id, stage, title, detail, assigned_to, assigned_seat, status, due_on, schedule_anchor, schedule_offset_days, schedule_offset_unit, description, done_when, video_url, is_required, blocks_handoff, evidence_required, requires_owner_approval, owner_dependency, sort_order, template_task_id")
        .eq("property_id", data.propertyId).is("archived_at", null).is("parent_task_id", null),
    ]);
    if (!home.data) throw new Error("That home is not available to you.");
    if (tasks.error) throw new Error(tasks.error.message);
    const rows = tasks.data ?? [];
    const tplIds = [...new Set(rows.map((t) => t.template_task_id).filter((x): x is string => !!x))];
    const people = [...new Set(rows.map((t) => t.assigned_to).filter((x): x is string => !!x))];
    const [tpl, profs] = await Promise.all([
      tplIds.length ? sb.from("onboarding_template_tasks").select("id, template_id, module, breezeway_template_id, opportunity, condition").in("id", tplIds) : Promise.resolve({ data: [] as never[] }),
      people.length ? sb.from("profiles").select("id, full_name, email").in("id", people) : Promise.resolve({ data: [] as never[] }),
    ]);
    const tplById = new Map((tpl.data ?? []).map((t: { id: string }) => [t.id, t as { id: string; template_id: string; module: string | null; breezeway_template_id: string | null; opportunity: Opp; condition: unknown }]));
    const templateIds = [...new Set([...tplById.values()].map((t) => t.template_id))];
    const stages = templateIds.length ? (await sb.from("onboarding_template_stages").select("name, sort_order").in("template_id", templateIds)).data ?? [] : [];
    const nameOf = new Map((profs.data ?? []).map((p: { id: string; full_name: string | null; email: string | null }) => [p.id, p.full_name ?? p.email]));
    const plan = home.data.name ?? "Home";
    const out = orderPlan(rows, stages).map(({ task: t, stageNo, taskNo }) => {
      const tt = t.template_task_id ? tplById.get(t.template_task_id) : undefined;
      return planRow({
        plan, stageNo, stage: t.stage, taskNo, title: t.title, detail: t.detail,
        role: t.assigned_seat, person: t.assigned_to ? nameOf.get(t.assigned_to) ?? "" : "", status: t.status, dueOn: t.due_on,
        anchor: t.schedule_anchor, offset: t.schedule_offset_days, required: t.is_required, blocksHandoff: t.blocks_handoff,
        evidence: t.evidence_required, ownerApproval: t.requires_owner_approval, ownerDependency: t.owner_dependency as string | null,
        module: tt?.module ?? "", breezeway: tt?.breezeway_template_id ?? "", opportunity: tt?.opportunity ?? null,
        unit: t.schedule_offset_unit, description: t.description, doneWhen: t.done_when, videoUrl: t.video_url,
        conditions: conditionToCsv(readCondition(tt?.condition).condition),
      });
    });
    return { filename: `${plan.replace(/[^\w.-]+/g, "_")}_onboarding_plan.csv`, csv: toCsv(PLAN_HEADER, out) };
  });

export const exportTemplateCsv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ templateId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const sb = context.supabase;
    const [tpl, stages, tasks] = await Promise.all([
      sb.from("onboarding_templates").select("name").eq("id", data.templateId).maybeSingle(),
      sb.from("onboarding_template_stages").select("name, sort_order").eq("template_id", data.templateId),
      sb.from("onboarding_template_tasks")
        .select("stage, title, detail, role, functional_role, schedule_anchor, offset_days, is_required, blocks_handoff, evidence_required, requires_owner_approval, owner_dependency, module, breezeway_template_id, opportunity, sort_order, is_active, offset_unit, description, done_when, video_url, condition")
        .eq("template_id", data.templateId),
    ]);
    if (!tpl.data) throw new Error("That template is not available to you.");
    if (tasks.error) throw new Error(tasks.error.message);
    const plan = tpl.data.name;
    const active = (tasks.data ?? []).filter((t) => t.is_active !== false);
    const out = orderPlan(active, stages.data ?? []).map(({ task: t, stageNo, taskNo }) =>
      planRow({
        plan, stageNo, stage: t.stage, taskNo, title: t.title, detail: t.detail,
        role: (t.functional_role as string | null) ?? t.role, person: "", status: "", dueOn: "",
        anchor: t.schedule_anchor, offset: t.offset_days, required: t.is_required, blocksHandoff: t.blocks_handoff,
        evidence: t.evidence_required, ownerApproval: t.requires_owner_approval, ownerDependency: t.owner_dependency as string | null,
        module: t.module, breezeway: t.breezeway_template_id, opportunity: t.opportunity as Opp,
        unit: t.offset_unit, description: t.description, doneWhen: t.done_when, videoUrl: t.video_url,
        conditions: conditionToCsv(readCondition(t.condition).condition),
      }),
    );
    return { filename: `${plan.replace(/[^\w.-]+/g, "_")}_template.csv`, csv: toCsv(PLAN_HEADER, out) };
  });
