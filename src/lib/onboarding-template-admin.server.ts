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
  BUILT_IN_TEMPLATE_KEY,
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
  "id, template_id, stage, title, role, detail, sort_order, blocks_handoff, requires_owner_approval, owner_approval_when_active_owner, evidence_required, schedule_anchor, offset_days, breezeway_template_id, subtasks, tags";

async function assertOnboardingStaff(supabase: Client, userId: string) {
  const { data, error } = await supabase.rpc("is_onboarding_staff", { _user_id: userId });
  if (error) throw new Error("Could not verify your access level.");
  if (!data) throw new Error("You do not have access to this action.");
}

async function assertSupervisor(supabase: Client, userId: string) {
  const { data, error } = await supabase.rpc("is_onboarding_leader", { _user_id: userId });
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

/**
 * Make the built-in ARHA plan an ordinary, editable template.
 *
 * The plan ships in code so a brand-new workspace has something to work with.
 * The first time the director edits it, that code plan is written into the
 * database once, keeps its own key, and from then on IS the built-in plan —
 * no duplicate, no copy to keep in step.
 */
export async function ensureBuiltInTemplate(
  supabase: Client,
  userId: string,
  audit: typeof writeAudit = writeAudit,
): Promise<{ id: string; created: boolean }> {
  await assertSupervisor(supabase, userId);

  const existing = await supabase
    .from("onboarding_templates")
    .select("id")
    .eq("key", BUILT_IN_TEMPLATE_KEY)
    .maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return { id: existing.data.id, created: false };

  const summary = builtInSummary();
  const created = await supabase
    .from("onboarding_templates")
    .insert({
      key: BUILT_IN_TEMPLATE_KEY,
      name: summary.name,
      description: summary.description,
      created_by: userId,
    })
    .select("id")
    .single();
  if (created.error) throw created.error;

  const rows = builtInAsRows(created.data.id);
  const inserted = await supabase.from("onboarding_template_tasks").insert(rows);
  if (inserted.error) throw inserted.error;

  await audit({
    actorId: userId,
    action: "onboarding_template_created",
    entityType: "onboarding_template",
    entityId: created.data.id,
    entityLabel: summary.name,
    after: { key: BUILT_IN_TEMPLATE_KEY, steps: rows.length, builtIn: true },
  });
  return { id: created.data.id, created: true };
}

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

  const saved = (templates.data ?? []).map((t) => ({
    id: t.id as string | null,
    key: t.key,
    name: t.name,
    description: t.description,
    isDefault: t.is_default,
    isArchived: t.is_archived,
    // Once the built-in plan has been written to the database it is still the
    // built-in plan — just an editable one.
    builtIn: t.key === BUILT_IN_TEMPLATE_KEY,
    taskCount: counts.get(t.id)?.tasks ?? 0,
    subtaskCount: counts.get(t.id)?.subtasks ?? 0,
  }));
  const materialised = saved.some((t) => t.key === BUILT_IN_TEMPLATE_KEY);
  return materialised ? saved : [builtInSummary(), ...saved];
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
  input: { name: string; description?: string | null | undefined; copyBuiltIn?: boolean | undefined },
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
    name?: string | undefined;
    description?: string | null | undefined;
    isArchived?: boolean | undefined;
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

/**
 * Removing a plan outright. The built-in ARHA plan stays — every home falls
 * back to it — and its steps go with it, so nothing is left orphaned.
 */
export async function deleteOnboardingTemplate(
  supabase: Client,
  userId: string,
  input: { templateId: string },
  audit: typeof writeAudit = writeAudit,
) {
  await assertSupervisor(supabase, userId);
  const found = await supabase
    .from("onboarding_templates")
    .select("id, key, name")
    .eq("id", input.templateId)
    .maybeSingle();
  if (found.error) throw found.error;
  if (!found.data) throw new Error("That plan no longer exists.");
  if (found.data.key === BUILT_IN_TEMPLATE_KEY)
    throw new Error("The ARHA plan is the fallback for every home and cannot be deleted.");

  const steps = await supabase
    .from("onboarding_template_tasks")
    .delete()
    .eq("template_id", input.templateId);
  if (steps.error) throw steps.error;
  const { error } = await supabase
    .from("onboarding_templates")
    .delete()
    .eq("id", input.templateId);
  if (error) throw error;

  await audit({
    actorId: userId,
    action: "onboarding_template_deleted",
    entityType: "onboarding_template",
    entityId: input.templateId,
    entityLabel: found.data.name,
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

/** Lower-case, trimmed, de-duplicated. "active_owner" is the reserved one. */
export function normaliseTags(tags: string[] | undefined) {
  const out: string[] = [];
  for (const raw of tags ?? []) {
    const tag = raw.trim().toLowerCase().replace(/\s+/g, "_").slice(0, 40);
    if (tag && !out.includes(tag)) out.push(tag);
  }
  return out.slice(0, 10);
}

export type TemplateStepInput = {
  templateId: string;
  stepId?: string | undefined;
  stage: string;
  title: string;
  role?: string | null | undefined;
  detail?: string | null | undefined;
  sortOrder?: number | null | undefined;
  blocksHandoff?: boolean | undefined;
  requiresOwnerApproval?: boolean | undefined;
  ownerApprovalWhenActiveOwner?: boolean | undefined;
  evidenceRequired?: boolean | undefined;
  scheduleAnchor?: "planned_closing" | "actual_closing" | "actual_access" | null | undefined;
  offsetDays?: number | null | undefined;
  breezewayTemplateId?: string | null | undefined;
  subtasks?: string[] | undefined;
  tags?: string[] | undefined;
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
    tags: normaliseTags(input.tags),
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

/**
 * Save a whole new arrangement: which stage each step sits in and the order
 * within it. The caller sends the complete list, so a step dragged into
 * another stage and the renumbering that follows are one save; only rows that
 * actually moved are written.
 */
export async function arrangeTemplateSteps(
  supabase: Client,
  userId: string,
  input: { templateId: string; order: { stepId: string; stage: string }[] },
) {
  await assertSupervisor(supabase, userId);
  const rows = await supabase
    .from("onboarding_template_tasks")
    .select("id, stage, sort_order")
    .eq("template_id", input.templateId);
  if (rows.error) throw rows.error;

  const current = new Map((rows.data ?? []).map((r) => [r.id, r]));
  if (input.order.length !== current.size) {
    throw new Error("The plan changed while you were arranging it. Refresh and try again.");
  }
  for (const entry of input.order) {
    if (!current.has(entry.stepId)) {
      throw new Error("The plan changed while you were arranging it. Refresh and try again.");
    }
  }

  let moved = 0;
  for (const [index, entry] of input.order.entries()) {
    const row = current.get(entry.stepId)!;
    const sortOrder = (index + 1) * 10;
    if (row.stage === entry.stage && row.sort_order === sortOrder) continue;
    const write = await supabase
      .from("onboarding_template_tasks")
      .update({ stage: entry.stage, sort_order: sortOrder })
      .eq("id", entry.stepId)
      .eq("template_id", input.templateId);
    if (write.error) throw write.error;
    moved += 1;
  }
  return { ok: true as const, moved };
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
    if (!row) {
      // Nothing marked default: the built-in plan applies, and if it has been
      // edited the edited version is the one that counts.
      const builtIn = await supabase
        .from("onboarding_templates")
        .select("id, key")
        .eq("key", BUILT_IN_TEMPLATE_KEY)
        .eq("is_archived", false)
        .maybeSingle();
      if (builtIn.error) throw builtIn.error;
      row = builtIn.data;
    }
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
