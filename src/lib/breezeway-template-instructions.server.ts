/**
 * Breezeway instructions read for onboarding work orders (server only, read only; never writes).
 * - templateInstructions: a template's own instructions. Breezeway's API lists templates by name only,
 *   so the text is read from the newest work orders Breezeway made from that template (template_id
 *   confirmed on each) and chosen by pickTemplateInstructions.
 * - workOrderInstructionsNow: a sent work order's instructions as Breezeway has them now.
 */
import { breezewayRequest } from "./breezeway.server";
import { listBreezewayTemplates } from "./breezeway-directory.server";
import { pickTemplateInstructions } from "./onboarding-work-order-status";

const TEMPLATE_TTL_MS = 10 * 60_000;
const NOW_TTL_MS = 60_000;
const MAX_LOOKS = 6;
const templateCache = new Map<number, { at: number; text: string | null }>();
const nowCache = new Map<number, { at: number; text: string | null; asOf: string }>();

type RawTask = { id?: number; template_id?: number | null; description?: string | null };

export async function templateInstructions(templateId: number): Promise<{ text: string | null }> {
  const hit = templateCache.get(templateId);
  if (hit && Date.now() - hit.at < TEMPLATE_TTL_MS) return { text: hit.text };
  const template = (await listBreezewayTemplates()).find((t) => t.id === templateId);
  if (!template) throw new Error("That Breezeway template is no longer available.");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("breezeway_work_orders")
    .select("breezeway_task_id")
    .eq("name", template.name)
    .order("breezeway_created_at", { ascending: false, nullsFirst: false })
    .limit(MAX_LOOKS);
  if (error) throw new Error("Could not look up this template's work orders.");
  const found: { taskId: number; text: string | null }[] = [];
  for (const row of (data ?? []) as { breezeway_task_id: number | string }[]) {
    const id = Number(row.breezeway_task_id);
    if (!Number.isFinite(id)) continue;
    const raw = await breezewayRequest<RawTask>(`/task/${id}`).catch(() => null);
    if (raw && Number(raw.template_id) === templateId) found.push({ taskId: id, text: raw.description ?? null });
  }
  const text = pickTemplateInstructions(found)?.text ?? null;
  templateCache.set(templateId, { at: Date.now(), text });
  return { text };
}

export async function workOrderInstructionsNow(breezewayTaskId: number): Promise<{ text: string | null; asOf: string }> {
  const hit = nowCache.get(breezewayTaskId);
  if (hit && Date.now() - hit.at < NOW_TTL_MS) return { text: hit.text, asOf: hit.asOf };
  const raw = await breezewayRequest<RawTask>(`/task/${breezewayTaskId}`);
  const out = { text: (raw?.description ?? "").trim() || null, asOf: new Date().toISOString() };
  nowCache.set(breezewayTaskId, { at: Date.now(), ...out });
  return out;
}
