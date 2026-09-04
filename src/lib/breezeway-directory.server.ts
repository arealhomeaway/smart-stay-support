/**
 * Breezeway directories used when composing a Work Order from Resolve
 * (server-only).
 *
 * Both lists come from Breezeway itself — nothing here is hardcoded, so a
 * template renamed or a worker deactivated in Breezeway is reflected in Resolve
 * on the next refresh. The operator can therefore only ever choose values
 * Breezeway will actually honour on create.
 */

import { breezewayRequest } from "./breezeway.server";
import type { BreezewayAssignee, BreezewayTemplate } from "./breezeway-outbound";

type TemplateRow = { id?: number; template_name?: string; department_code?: string | null };
type PersonRow = {
  id?: number;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  active?: boolean;
};

const TTL_MS = 10 * 60_000;
let templateCache: { at: number; rows: BreezewayTemplate[] } | null = null;
let peopleCache: { at: number; rows: BreezewayAssignee[] } | null = null;

/** Active Breezeway checklist templates, usable as `template_id` on create. */
export async function listBreezewayTemplates(): Promise<BreezewayTemplate[]> {
  if (templateCache && Date.now() - templateCache.at < TTL_MS) return templateCache.rows;
  const raw = await breezewayRequest<TemplateRow[]>("/companies/templates");
  const rows = (Array.isArray(raw) ? raw : [])
    .filter((t): t is TemplateRow & { id: number } => typeof t.id === "number")
    .map((t) => ({
      id: t.id,
      name: (t.template_name ?? `Template ${t.id}`).trim(),
      department: t.department_code ?? null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  templateCache = { at: Date.now(), rows };
  return rows;
}

/** Active Breezeway people, usable as `assignments` ids on create. */
export async function listAssignableBreezewayPeople(): Promise<BreezewayAssignee[]> {
  if (peopleCache && Date.now() - peopleCache.at < TTL_MS) return peopleCache.rows;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("breezeway_people")
    .select("breezeway_person_id, first_name, last_name, email, active, is_integration_identity")
    .eq("active", true)
    .eq("is_integration_identity", false);

  let rows: BreezewayAssignee[] = ((data ?? []) as PersonRow[] as never[])
    .map((p: unknown) => {
      const r = p as {
        breezeway_person_id: number;
        first_name: string | null;
        last_name: string | null;
        email: string | null;
      };
      const name = `${r.first_name ?? ""} ${r.last_name ?? ""}`.replace(/\s+/g, " ").trim();
      return {
        id: r.breezeway_person_id,
        name: name || `Breezeway person ${r.breezeway_person_id}`,
        email: r.email,
      };
    })
    .filter((p) => Number.isFinite(p.id));

  // The mirror can be stale; fall back to Breezeway directly rather than
  // presenting an empty assignee list that would look like "nobody available".
  if (!rows.length) {
    const raw = await breezewayRequest<{ results?: PersonRow[] } | PersonRow[]>("/people");
    const list = Array.isArray(raw) ? raw : (raw?.results ?? []);
    rows = list
      .filter(
        (p): p is PersonRow & { id: number } => typeof p.id === "number" && p.active !== false,
      )
      .map((p) => ({
        id: p.id,
        name:
          `${p.first_name ?? ""} ${p.last_name ?? ""}`.replace(/\s+/g, " ").trim() ||
          `Breezeway person ${p.id}`,
        email: p.email ?? null,
      }));
  }

  rows.sort((a, b) => a.name.localeCompare(b.name));
  peopleCache = { at: Date.now(), rows };
  return rows;
}
