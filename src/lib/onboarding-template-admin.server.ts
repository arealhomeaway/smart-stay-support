/**
 * Template authoring for the onboarding director (server-only).
 *
 * Reading a template is onboarding-staff work; changing one is supervisor work
 * (the onboarding director and platform owners). Every change is audited.
 * Nothing here touches a live project: applying a template stays the separate,
 * preview-and-confirm action in onboarding-template.server.ts.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { writeAudit } from "./audit.server";
import {
  builtInAsRows,
  builtInSummary,
  templateKeyFrom,
  toTemplateTasks,
  type TemplateSummary,
  type TemplateTaskRow,
} from "./onboarding-template-catalog";
import type { TemplateTask } from "./onboarding-template";

type Client = SupabaseClient<Database>;

const TASK_COLUMNS =
  "id, template_id, stage, title, role, detail, sort_order, blocks_handoff, requires_owner_approval, owner_approval_when_active_owner, evidence_required, schedule_anchor, offset_days, breezeway_template_id, subtasks";

async function assertOnboardingStaff(supabase: Client, userId: string) {
  const { data, error } = await supabase.rpc("is_onboarding_staff", { _user_id: userId });
  if (error) throw new Error("Could not verify your access level.");
  if (!data) throw new Error("You do not have access to this action.");
}

async function assertSupervisor(supabase: Client, userId: string) {
  const { data, error } = await supabase.rpc("is_supervisor", { _user_id: userId });
  if (error) throw new Error("Could not verify your access level.");
  if (!data) throw new Error("Only the onboarding director can change templates.");
}

export type TemplateStep = TemplateTask & { id: string };

export type TemplateDetail = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  isArchived: boolean;
  steps: TemplateStep[];
};

export async function listOnboardingTemplates(
  supabase: Client,
  userId: string,
): Promise<TemplateSummary[]> {
  await assertOnboardingStaff(supabase, userId);
  const templates = await supabase
    .from("onboarding_templates")
    .select("id, key, name, description, is_default, is_archived")
    .order("created_at");
  if (templates.error) throw templates.error;

  const ids = (templates.data ?? []).map((t) => t.id);
  const counts = new Map<string, { tasks: number; subtasks: number }>();
  if (ids.length) {
    const rows = await supabase
      .from("onboarding_template_tasks")
      .select("template_id, subtasks")
      .in("template_id", ids);
    if (rows.error) throw rows.error;
    for (const r of rows.data ?? []) {
      const entry = counts.get(r.template_id) ?? { tasks: 0, subtasks: 0 };
      entry.tasks += 1;
      entry.subtasks += (r.subtasks ?? []).length;
      counts.set(r.template_id, entry);
    }
  }

  return [
    builtInSummary(),
    ...(templates.data ?? []).map((t) => ({
      id: t.id,
      key: t.key,
      name: t.name,
      description: t.description,
      isDefault: t.is_default,
      isArchived: t.is_archived,
      builtIn: false,
      taskCount: counts.get(t.id)?.tasks ?? 0,
      subtaskCount: counts.get(t.id)?.subtasks ?? 0,
    })),
  ];
}

export async function readOnboardingTemplate(
  supabase: Client,
  userId: string,
  input: { templateId: string },
): Promise<TemplateDetail> {
  await assertOnboardingStaff(supabase, userId);
  const template = await supabase
    .from("onboarding_templates")
    .select("id, key, name, description, is_default, is_archived")
    .eq("id", input.templateId)
    .single();
  if (template.error) throw template.error;

  const tasks = await supabase
    .from("onboarding_template_tasks")
    .select(TASK_COLUMNS)
    .eq("template_id", input.templateId);
  if (tasks.error) throw tasks.error;

  const rows = (tasks.data ?? []) as TemplateTaskRow[];
  const steps = toTemplateTasks(rows).map((t) => ({ ...t, id: t.key }));
  return {
    id: template.data.id,
    key: template.data.key,
    name: template.data.name,
    description: template.data.description,
    isDefault: template.data.is_default,
    isArchived: template.data.is_archived,
    steps,
  };
}

async function uniqueKey(supabase: Client, name: string) {
  const base = templateKeyFrom(name);
  const existing = await supabase.from("onboarding_templates").select("key").like("key", `${base}%`);
  if (existing.error) throw existing.error;
  const taken = new Set((existing.data ?? []).map((r) => r.key));
  if (!taken.has(base)) return base;
  for (let i = 2; i < 200; i += 1) if (!taken.has(`${base}_${i}`)) return `${base}_${i}`;
  return `${base}_${Date.now()}`;
}

export async function createOnboardingTemplate(
  supabase: Client,
  userId: string,
  input: { name: string; description?: string | null; copyBuiltIn?: boolean },
  audit: typeof writeAudit = writeAudit,
) {
  await assertSupervisor(supabase, userId);
  const name = input.name.trim();
  if (name.length < 3) throw new Error("Give the template a name of at least three characters.");

  const key = await uniqueKey(supabase, name);
  const created = await supabase
    .from("onboarding_templates")
    .insert({
      key,
      name,
      description: input.description?.trim() || null,
      created_by: userId,
    })
    .select("id, key, name")
    .single();
  if (created.error) throw created.error;

  let steps = 0;
  if (input.copyBuiltIn) {
    const rows = builtInAsRows(created.data.id);
    const inserted = await supabase.from("onboarding_template_tasks").insert(rows);
    if (inserted.error) throw inserted.error;
    steps = rows.length;
  }

  await audit({
    actorId: userId,
    action: "onboarding_template_created",
    entityType: "onboarding_template",
    entityId: created.data.id,
    entityLabel: name,
    after: { key, steps, copiedBuiltIn: Boolean(input.copyBuiltIn) },
  });
  return { id: created.data.id, key, steps };
}

export async function updateOnboardingTemplate(
  supabase: Client,
  userId: string,
  input: {
    templateId: string;
    name?: string;
    description?: string | null;
    isArchived?: boolean;
  },
  audit: typeof writeAudit = writeAudit,
) {
  await assertSupervisor(supabase, userId);
  const patch: {
    name?: string;
    description?: string | null;
    is_archived?: boolean;
    is_default?: boolean;
  } = {};
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (name.length < 3) throw new Error("Give the template a name of at least three characters.");
    patch.name = name;
  }
  if (input.description !== undefined) patch.description = input.description?.trim() || null;
  if (input.isArchived !== undefined) {
    patch.is_archived = input.isArchived;
    if (input.isArchived) patch.is_default = false;
  }
  if (!Object.keys(patch).length) return { ok: true as const };

  const { error } = await supabase
    .from("onboarding_templates")
    .update(patch)
    .eq("id", input.templateId);
  if (error) throw error;

  await audit({
    actorId: userId,
    action: "onboarding_template_updated",
    entityType: "onboarding_template",
    entityId: input.templateId,
    after: patch,
  });
  return { ok: true as const };
}

export async function setDefaultOnboardingTemplate(
  supabase: Client,
  userId: string,
  input: { templateId: string | null },
  audit: typeof writeAudit = writeAudit,
) {
  await assertSupervisor(supabase, userId);
  // Only one default at a time; clearing it falls back to the built-in plan.
  const cleared = await supabase
    .from("onboarding_templates")
    .update({ is_default: false })
    .eq("is_default", true);
  if (cleared.error) throw cleared.error;

  if (input.templateId) {
    const { error } = await supabase
      .from("onboarding_templates")
      .update({ is_default: true })
      .eq("id", input.templateId)
      .eq("is_archived", false);
    if (error) throw error;
  }

  await audit({
    actorId: userId,
    action: "onboarding_template_default_set",
    entityType: "onboarding_template",
    entityId: input.templateId ?? "built_in",
    after: { templateId: input.templateId },
  });
  return { ok: true as const };
}

export type TemplateStepInput = {
  templateId: string;
  stepId?: string;
  stage: string;
  title: string;
  role?: string | null;
  detail?: string | null;
  sortOrder?: number | null;
  blocksHandoff?: boolean;
  requiresOwnerApproval?: boolean;
  ownerApprovalWhenActiveOwner?: boolean;
  evidenceRequired?: boolean;
  scheduleAnchor?: "planned_closing" | "actual_closing" | "actual_access" | null;
  offsetDays?: number | null;
  breezewayTemplateId?: string | null;
  subtasks?: string[];
};

export async function saveTemplateStep(
  supabase: Client,
  userId: string,
  input: TemplateStepInput,
  audit: typeof writeAudit = writeAudit,
) {
  await assertSupervisor(supabase, userId);
  const title = input.title.trim();
  if (title.length < 3) throw new Error("Give the step a title of at least three characters.");
  if (!input.stage.trim()) throw new Error("Choose the stage this step belongs to.");

  let sortOrder = input.sortOrder ?? null;
  if (sortOrder === null && !input.stepId) {
    const last = await supabase
      .from("onboarding_template_tasks")
      .select("sort_order")
      .eq("template_id", input.templateId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (last.error) throw last.error;
    sortOrder = (last.data?.sort_order ?? 0) + 10;
  }

  const row = {
    template_id: input.templateId,
    stage: input.stage.trim(),
    title,
    role: input.role?.trim() || null,
    detail: input.detail?.trim() || null,
    blocks_handoff: Boolean(input.blocksHandoff),
    requires_owner_approval: Boolean(input.requiresOwnerApproval),
    owner_approval_when_active_owner: Boolean(input.ownerApprovalWhenActiveOwner),
    evidence_required: Boolean(input.evidenceRequired),
    schedule_anchor: input.scheduleAnchor ?? null,
    offset_days: input.scheduleAnchor ? (input.offsetDays ?? 0) : null,
    breezeway_template_id: input.breezewayTemplateId?.trim() || null,
    subtasks: (input.subtasks ?? []).map((s) => s.trim()).filter(Boolean),
    ...(sortOrder === null ? {} : { sort_order: sortOrder }),
  };

  if (input.stepId) {
    const { error } = await supabase
      .from("onboarding_template_tasks")
      .update(row)
      .eq("id", input.stepId)
      .eq("template_id", input.templateId);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("onboarding_template_tasks").insert(row);
    if (error) throw error;
  }

  await audit({
    actorId: userId,
    action: "onboarding_template_updated",
    entityType: "onboarding_template",
    entityId: input.templateId,
    entityLabel: title,
    after: { step: input.stepId ?? "new", title, stage: row.stage },
  });
  return { ok: true as const };
}

export async function deleteTemplateStep(
  supabase: Client,
  userId: string,
  input: { templateId: string; stepId: string },
  audit: typeof writeAudit = writeAudit,
) {
  await assertSupervisor(supabase, userId);
  const { error } = await supabase
    .from("onboarding_template_tasks")
    .delete()
    .eq("id", input.stepId)
    .eq("template_id", input.templateId);
  if (error) throw error;
  await audit({
    actorId: userId,
    action: "onboarding_template_step_deleted",
    entityType: "onboarding_template",
    entityId: input.templateId,
    after: { step: input.stepId },
  });
  return { ok: true as const };
}

/** Move one step up or down in the plan order. */
export async function reorderTemplateStep(
  supabase: Client,
  userId: string,
  input: { templateId: string; stepId: string; direction: "up" | "down" },
) {
  await assertSupervisor(supabase, userId);
  const rows = await supabase
    .from("onboarding_template_tasks")
    .select("id, sort_order")
    .eq("template_id", input.templateId)
    .order("sort_order");
  if (rows.error) throw rows.error;
  const list = rows.data ?? [];
  const index = list.findIndex((r) => r.id === input.stepId);
  if (index < 0) throw new Error("That step is no longer in this template.");
  const swapWith = input.direction === "up" ? index - 1 : index + 1;
  if (swapWith < 0 || swapWith >= list.length) return { ok: true as const };

  const a = list[index]!;
  const b = list[swapWith]!;
  const first = await supabase
    .from("onboarding_template_tasks")
    .update({ sort_order: b.sort_order })
    .eq("id", a.id);
  if (first.error) throw first.error;
  const second = await supabase
    .from("onboarding_template_tasks")
    .update({ sort_order: a.sort_order })
    .eq("id", b.id);
  if (second.error) throw second.error;
  return { ok: true as const };
}

/**
 * The plan a new home should get: the template marked default, or the built-in
 * plan when nothing is marked (or the marked one has no steps yet).
 */
export async function resolveTemplateTasks(
  supabase: Client,
  templateId?: string | null,
): Promise<{ templateKey: string; templateId: string | null; tasks: TemplateTask[] } | null> {
  let row: { id: string; key: string } | null = null;
  if (templateId) {
    const found = await supabase
      .from("onboarding_templates")
      .select("id, key")
      .eq("id", templateId)
      .maybeSingle();
    if (found.error) throw found.error;
    row = found.data;
  } else {
    const found = await supabase
      .from("onboarding_templates")
      .select("id, key")
      .eq("is_default", true)
      .eq("is_archived", false)
      .maybeSingle();
    if (found.error) throw found.error;
    row = found.data;
  }
  if (!row) return null;

  const tasks = await supabase
    .from("onboarding_template_tasks")
    .select(TASK_COLUMNS)
    .eq("template_id", row.id);
  if (tasks.error) throw tasks.error;
  const shaped = toTemplateTasks((tasks.data ?? []) as TemplateTaskRow[]);
  if (!shaped.length) return null;
  return { templateKey: row.key, templateId: row.id, tasks: shaped };
}
