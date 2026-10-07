/** CSV building for onboarding plan and template exports. Pure; Excel-safe. */
import { ONBOARDING_STAGES } from "./onboarding";

export function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  let s = typeof v === "string" ? v : typeof v === "object" ? JSON.stringify(v) : String(v);
  // Formula injection guard for spreadsheet apps.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: string[], rows: unknown[][]): string {
  // BOM so Excel reads UTF-8; CRLF line endings.
  return "\uFEFF" + [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

type StageRef = { name: string; sort_order: number | null };
type TaskLike = { stage: string | null; sort_order: number | null; title: string };

/** Stage order: saved template stages, then the standard phase order, then any other stage in appearance order; then Task order. */
export function orderPlan<T extends TaskLike>(tasks: T[], stages: StageRef[]): { task: T; stageNo: number; taskNo: number }[] {
  const order = new Map<string, number>();
  [...stages].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).forEach((s) => order.set(s.name, order.size));
  // Plans without saved stages use the standard phase order shown on screen
  // (Post contract, Phase 1…6, then the Master stages), never database order.
  const used = new Set(tasks.map((t) => t.stage ?? ""));
  for (const s of ONBOARDING_STAGES) if (used.has(s.value) && !order.has(s.value)) order.set(s.value, order.size);
  for (const t of tasks) if (!order.has(t.stage ?? "")) order.set(t.stage ?? "", order.size);
  const sorted = [...tasks].sort(
    (a, b) => order.get(a.stage ?? "")! - order.get(b.stage ?? "")! || (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.title.localeCompare(b.title),
  );
  const counters = new Map<string, number>();
  return sorted.map((task) => {
    const n = (counters.get(task.stage ?? "") ?? 0) + 1;
    counters.set(task.stage ?? "", n);
    return { task, stageNo: order.get(task.stage ?? "")! + 1, taskNo: n };
  });
}

export const PLAN_HEADER = [
  "Plan", "Stage order", "Stage", "Task order", "Task", "Internal instructions",
  "Assigned role", "Assigned person", "Status", "Due date", "Due rule",
  "Required", "Blocks handoff", "Evidence required", "Owner approval", "Owner dependency",
  "Module", "Breezeway template", "Owner Opportunity", "Owner-facing title", "Owner-facing what", "Owner-facing why", "Owner-facing how",
];

type Opp = { title?: string; what?: string; why?: string; how?: string } | null | undefined;

export function dueRule(anchor: string | null | undefined, offset: number | null | undefined) {
  if (!anchor) return "";
  const n = offset ?? 0;
  return `${Math.abs(n)} day(s) ${n < 0 ? "before" : "after"} ${anchor.replace(/_/g, " ")}`;
}

export function planRow(input: {
  plan: string; stageNo: number; stage: string | null; taskNo: number; title: string; detail: string | null;
  role: string | null; person: string | null; status: string | null; dueOn: string | null; anchor: string | null; offset: number | null;
  required: boolean | null; blocksHandoff: boolean | null; evidence: boolean | null; ownerApproval: boolean | null; ownerDependency: string | null;
  module: string | null; breezeway: string | null; opportunity: Opp;
}): unknown[] {
  const yn = (b: boolean | null) => (b === null || b === undefined ? "" : b ? "Yes" : "No");
  const o = input.opportunity;
  return [
    input.plan, input.stageNo, input.stage, input.taskNo, input.title, input.detail,
    input.role, input.person, input.status, input.dueOn, dueRule(input.anchor, input.offset),
    yn(input.required), yn(input.blocksHandoff), yn(input.evidence), yn(input.ownerApproval), input.ownerDependency,
    input.module, input.breezeway, o ? "Yes" : "No", o?.title ?? "", o?.what ?? "", o?.why ?? "", o?.how ?? "",
  ];
}
