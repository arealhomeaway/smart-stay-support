/**
 * Template CSV import: reads the same columns Resolve's plan/template export
 * writes and turns them into a NEW template draft. Pure; no I/O.
 *
 * Kept from each row: Stage order, Stage, Task order, Task, Internal
 * instructions, Assigned role, Due rule, Required, Blocks handoff, Evidence
 * required, Owner approval, Owner dependency, Module, Breezeway template,
 * Owner Opportunity + Owner-facing title/what/why/how.
 * Ignored on purpose (property-specific state): Plan, Assigned person,
 * Status, Due date.
 */
import { parseCsv } from "./csv";
import { PLAN_HEADER } from "./plan-csv";

export const IMPORT_IGNORED_COLUMNS = ["Plan", "Assigned person", "Status", "Due date"] as const;
export const IMPORT_REQUIRED_COLUMNS = ["Stage", "Task"] as const;
import { conditionFromCsv, type StepCondition } from "./plan-rules";
const ANCHORS = {
  "planned closing": "planned_closing",
  "actual closing": "actual_closing",
  "actual access": "actual_access",
  "confirmed access date": "actual_access",
  "project created": "project_created",
  "target handoff": "target_handoff",
} as const;
/** Code → label of the onboarding roles a template step may name. */
const ROLE_LABELS: Record<string, string> = {
  onboarding_director: "Director of Onboarding",
  onboarding_manager: "Onboarding Manager",
  onboarding_project_manager: "Project Manager",
  utilities: "Onboarding Utilities Coordinator",
  lead_designer: "Lead Designer",
  designer: "Designer",
  staging_team: "Staging Team",
  design_staging: "Design & Staging (older steps)",
};
function roleCode(v: string): string | null | "invalid" {
  const s = v.trim();
  if (!s || s.toLowerCase() === "unassigned") return null;
  if (ROLE_LABELS[s]) return s;
  const hit = Object.entries(ROLE_LABELS).find(([, label]) => label.toLowerCase() === s.toLowerCase());
  // Older exports wrote these labels.
  const legacy: Record<string, string> = {
    "onboarding project manager": "onboarding_project_manager",
    "assigned project manager": "onboarding_project_manager",
    "onboarding director": "onboarding_director",
    "utilities coordinator": "utilities",
    utilities: "utilities",
    design: "design_staging",
  };
  return hit?.[0] ?? legacy[s.toLowerCase()] ?? "invalid";
}
const DEPENDENCIES = new Set(["none", "information", "feedback", "acknowledge", "business_decision"]);

export type ImportedTask = {
  row: number;
  stage: string;
  title: string;
  detail: string | null;
  role: string | null;
  functionalRole: string | null;
  scheduleAnchor: string | null;
  offsetDays: number | null;
  offsetUnit: "calendar" | "business";
  description: string | null;
  doneWhen: string | null;
  videoUrl: string | null;
  condition: StepCondition;
  isRequired: boolean;
  blocksHandoff: boolean;
  evidenceRequired: boolean;
  requiresOwnerApproval: boolean;
  ownerDependency: string | null;
  module: string | null;
  breezewayTemplateId: string | null;
  opportunity: { title: string; what: string; why: string; how: string } | null;
  sortOrder: number;
};
export type ImportPreview = {
  stages: { name: string; order: number; tasks: ImportedTask[] }[];
  errors: { row: number; message: string }[];
  /** Kept, but explained: values Resolve stores without acting on. */
  warnings: { row: number; message: string }[];
  ignoredColumns: string[];
  taskCount: number;
};

function yesNo(v: string, row: number, col: string, errors: ImportPreview["errors"], dflt: boolean) {
  const s = v.trim().toLowerCase();
  if (!s) return dflt;
  if (["yes", "y", "true", "1"].includes(s)) return true;
  if (["no", "n", "false", "0"].includes(s)) return false;
  errors.push({ row, message: `${col} must be Yes or No (found "${v}").` });
  return dflt;
}

/** Undo the export's spreadsheet formula guard. */
const unguard = (s: string) => (/^'[=+\-@]/.test(s) ? s.slice(1) : s);

export function parseDueRule(v: string): { anchor: string; offset: number; unit: "calendar" | "business" } | null | "invalid" {
  const s = v.trim().toLowerCase();
  if (!s) return null;
  const m = /^(\d+)\s*(business\s+)?day\(?s?\)?\s+(before|after)\s+(planned closing|actual closing|actual access|confirmed access date|project created|target handoff)$/.exec(s);
  if (!m) return "invalid";
  const n = Number(m[1]);
  return { anchor: ANCHORS[m[4] as keyof typeof ANCHORS], offset: m[3] === "before" ? -n : n, unit: m[2] ? "business" : "calendar" };
}

export function parseTemplateCsv(text: string): ImportPreview {
  const errors: ImportPreview["errors"] = [];
  const warnings: ImportPreview["warnings"] = [];
  const rows = parseCsv(text.replace(/^\uFEFF/, "")).filter((r) => r.some((c) => c.trim() !== ""));
  if (rows.length === 0) return { stages: [], errors: [{ row: 1, message: "The file is empty." }], warnings, ignoredColumns: [], taskCount: 0 };
  const header = rows[0]!.map((h) => h.trim());
  const idx = (name: string) => header.findIndex((h) => h.toLowerCase() === name.toLowerCase());
  for (const c of IMPORT_REQUIRED_COLUMNS) if (idx(c) < 0) errors.push({ row: 1, message: `Missing the "${c}" column.` });
  const unknown = header.filter((h) => h && !PLAN_HEADER.some((p) => p.toLowerCase() === h.toLowerCase()));
  if (unknown.length) errors.push({ row: 1, message: `Unknown column(s): ${unknown.join(", ")}. Use the columns from a Resolve export.` });
  if (errors.length) return { stages: [], errors, warnings, ignoredColumns: [], taskCount: 0 };
  const get = (r: string[], name: string) => { const i = idx(name); return i >= 0 ? unguard((r[i] ?? "").trim()) : ""; };

  const stageOrder = new Map<string, number>();
  const tasks: (ImportedTask & { taskOrder: number })[] = [];
  const seen = new Set<string>();
  rows.slice(1).forEach((r, i) => {
    const row = i + 2;
    const stage = get(r, "Stage");
    const title = get(r, "Task");
    if (!stage) errors.push({ row, message: "Stage is blank." });
    if (!title) errors.push({ row, message: "Task is blank." });
    if (!stage || !title) return;
    if (stage.length > 120) errors.push({ row, message: "Stage name is longer than 120 characters." });
    if (title.length > 300) errors.push({ row, message: "Task title is longer than 300 characters." });
    const key = `${stage.toLowerCase()}|${title.toLowerCase()}`;
    if (seen.has(key)) errors.push({ row, message: `"${title}" appears twice in stage "${stage}".` });
    seen.add(key);
    const so = get(r, "Stage order");
    const soN = so ? Number(so) : NaN;
    if (so && !Number.isFinite(soN)) errors.push({ row, message: `Stage order must be a number (found "${so}").` });
    if (!stageOrder.has(stage)) stageOrder.set(stage, Number.isFinite(soN) ? soN : 10_000 + stageOrder.size);
    else if (Number.isFinite(soN) && stageOrder.get(stage)! < 10_000 && stageOrder.get(stage) !== soN)
      errors.push({ row, message: `Stage "${stage}" has two different Stage order numbers.` });
    const to = get(r, "Task order");
    const toN = to ? Number(to) : NaN;
    if (to && !Number.isFinite(toN)) errors.push({ row, message: `Task order must be a number (found "${to}").` });
    const rule = parseDueRule(get(r, "Due rule"));
    if (rule === "invalid") errors.push({ row, message: `Due rule must look like "3 business day(s) before planned closing" — anchors: project created, planned closing, actual access, target handoff (found "${get(r, "Due rule")}").` });
    const roleRaw = get(r, "Assigned role");
    const role = roleCode(roleRaw);
    // Older plans carry free-text roles; they are kept as a label but cannot be resolved from the project team.
    if (role === "invalid") warnings.push({ row, message: `Assigned role "${roleRaw}" is not an onboarding team role, so it is kept as a label only and no one will be assigned automatically.` });
    const cond = conditionFromCsv(get(r, "Conditions"));
    if (cond.error) errors.push({ row, message: cond.error });
    const video = get(r, "Video link");
    if (video && !/^https:\/\//.test(video)) errors.push({ row, message: `Video link must start with https:// (found "${video}").` });
    const dep = get(r, "Owner dependency").toLowerCase().replace(/\s+/g, "_");
    if (dep && !DEPENDENCIES.has(dep)) errors.push({ row, message: `Owner dependency "${get(r, "Owner dependency")}" is not one of: none, information, feedback, acknowledge, business_decision.` });
    const opp = yesNo(get(r, "Owner Opportunity"), row, "Owner Opportunity", errors, false);
    const oppTitle = get(r, "Owner-facing title");
    if (opp && !oppTitle) errors.push({ row, message: "Owner Opportunity is Yes but Owner-facing title is blank." });
    tasks.push({
      row, stage, title,
      detail: get(r, "Internal instructions") || null,
      role: role === "invalid" ? roleRaw : role ? ROLE_LABELS[role]! : null,
      functionalRole: role && role !== "invalid" ? role : null,
      scheduleAnchor: rule && rule !== "invalid" ? rule.anchor : null,
      offsetDays: rule && rule !== "invalid" ? rule.offset : null,
      offsetUnit: rule && rule !== "invalid" ? rule.unit : "calendar",
      description: get(r, "Description") || null,
      doneWhen: get(r, "Done when") || null,
      videoUrl: video || null,
      condition: cond.condition,
      isRequired: yesNo(get(r, "Required"), row, "Required", errors, true),
      blocksHandoff: yesNo(get(r, "Blocks handoff"), row, "Blocks handoff", errors, false),
      evidenceRequired: yesNo(get(r, "Evidence required"), row, "Evidence required", errors, false),
      requiresOwnerApproval: yesNo(get(r, "Owner approval"), row, "Owner approval", errors, false),
      ownerDependency: dep && DEPENDENCIES.has(dep) ? dep : null,
      module: get(r, "Module") || null,
      breezewayTemplateId: get(r, "Breezeway template") || null,
      opportunity: opp && oppTitle ? { title: oppTitle, what: get(r, "Owner-facing what"), why: get(r, "Owner-facing why"), how: get(r, "Owner-facing how") } : null,
      sortOrder: 0,
      taskOrder: Number.isFinite(toN) ? toN : 10_000 + i,
    });
  });
  if (!tasks.length && !errors.length) errors.push({ row: 2, message: "No Tasks found." });

  const ordered = [...stageOrder.entries()].sort((a, b) => a[1] - b[1]).map(([name]) => name);
  let n = 0;
  const stages = ordered.map((name, si) => {
    const list = tasks.filter((t) => t.stage === name).sort((a, b) => a.taskOrder - b.taskOrder || a.row - b.row);
    return { name, order: si + 1, tasks: list.map(({ taskOrder: _t, ...t }) => ({ ...t, sortOrder: (n += 10) })) };
  });
  const ignoredColumns = IMPORT_IGNORED_COLUMNS.filter((c) => idx(c) >= 0);
  return { stages, errors: errors.sort((a, b) => a.row - b.row), warnings, ignoredColumns, taskCount: tasks.length };
}
