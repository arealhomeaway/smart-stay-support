/**
 * Breezeway sync pilot (server-only, one property at a time).
 *
 * Scope is deliberately tiny:
 *   - store a Breezeway property ID on ONE Resolve property
 *   - read that property's tasks for an admin preview
 *
 * What this file never does: change a property's lifecycle stage, create
 * matters, assign vendors, notify anyone, register webhooks, or write anything
 * back to Breezeway. Breezeway "active" carries no meaning for Resolve's
 * lifecycle_status and is never copied into it.
 */
import {
  BREEZEWAY_PREVIEW_LOOKAHEAD_DAYS,
  BREEZEWAY_PREVIEW_LOOKBACK_DAYS,
  type BreezewayPilotPreview,
  type BreezewayTaskSummary,
} from "./breezeway";
import { listBreezewayProperties, listBreezewayTasksForHome } from "./breezeway.server";

function normalize(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/[.,#]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isoDate(offsetDays: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

const OPEN_STAGES = new Set(["created", "assigned", "started", "paused", "scheduled", "open"]);

type ResolveRow = {
  id: string;
  name: string | null;
  address_line1: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  lifecycle_status: string;
  breezeway_property_id: string | null;
  breezeway_synced_at: string | null;
};

async function loadProperty(resolveId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("properties")
    .select(
      "id, name, address_line1, city, state, postal_code, lifecycle_status, breezeway_property_id, breezeway_synced_at",
    )
    .eq("id", resolveId)
    .maybeSingle();
  if (error) throw new Error("Could not read the Resolve property.");
  if (!data) throw new Error("That Resolve property does not exist.");
  return data as unknown as ResolveRow;
}

/**
 * Saves the Breezeway property ID on a single Resolve property.
 * Refuses if another Resolve property already claims that Breezeway ID.
 * Touches no other column — lifecycle stage stays exactly as it is.
 */
export async function saveBreezewayPropertyMapping(resolveId: string, breezewayId: string) {
  const property = await loadProperty(resolveId);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: clash, error: clashError } = await supabaseAdmin
    .from("properties")
    .select("id, name")
    .eq("breezeway_property_id", breezewayId)
    .neq("id", resolveId);
  if (clashError) throw new Error("Could not check existing Breezeway links.");
  if (clash && clash.length > 0) {
    throw new Error(
      `Breezeway property ${breezewayId} is already linked to another Resolve home. Nothing was changed.`,
    );
  }

  const { error } = await supabaseAdmin
    .from("properties")
    .update({
      breezeway_property_id: breezewayId,
      breezeway_synced_at: new Date().toISOString(),
    })
    .eq("id", resolveId);
  if (error) throw new Error("Could not save the mapping.");

  return {
    resolveId,
    resolveName: property.name,
    breezewayId,
    lifecycleStatusUnchanged: property.lifecycle_status,
  };
}

/**
 * Read-only preview of one mapped property's Breezeway tasks. Requires the
 * mapping to already be saved so the preview can never invent a link.
 */
export async function buildBreezewayPilotPreview(resolveId: string): Promise<BreezewayPilotPreview> {
  const property = await loadProperty(resolveId);
  const breezewayId = property.breezeway_property_id;
  if (!breezewayId) throw new Error("This property has no saved Breezeway mapping yet.");

  const { items: inventory } = await listBreezewayProperties();
  const match = inventory.find((p) => String(p.id) === String(breezewayId)) ?? null;

  const tasks = await listBreezewayTasksForHome(breezewayId);

  const windowStart = isoDate(-BREEZEWAY_PREVIEW_LOOKBACK_DAYS);
  const windowEnd = isoDate(BREEZEWAY_PREVIEW_LOOKAHEAD_DAYS);

  const inWindow: BreezewayTaskSummary[] = tasks.items
    .filter((t) => t.scheduledDate && t.scheduledDate >= windowStart && t.scheduledDate <= windowEnd)
    .sort((a, b) => (a.scheduledDate ?? "").localeCompare(b.scheduledDate ?? ""));

  const unscheduledOpen = tasks.items.filter(
    (t) => !t.scheduledDate && OPEN_STAGES.has((t.stage ?? "").toLowerCase()),
  );

  const breezewayAddress = match
    ? [match.address, match.city, match.state, match.zipcode].filter(Boolean).join(", ")
    : null;
  const resolveAddress = [property.address_line1, property.city, property.state, property.postal_code]
    .filter(Boolean)
    .join(", ");

  return {
    resolveId: property.id,
    resolveName: property.name,
    resolveAddress,
    resolveLifecycleStatus: property.lifecycle_status,
    breezewayId: String(breezewayId),
    breezewayName: match?.name ?? null,
    breezewayAddress,
    breezewayStatus: match?.status ?? null,
    addressMatches:
      Boolean(match) && normalize(match?.address ?? "") === normalize(property.address_line1 ?? ""),
    windowStart,
    windowEnd,
    tasksTotalForProperty: tasks.totalResults,
    tasksInWindow: inWindow,
    unscheduledOpenTasks: unscheduledOpen,
    pagesFetched: tasks.pagesFetched,
    totalPages: tasks.totalPages,
    pagesRemaining: tasks.pagesRemaining > 0,
    mappingSavedAt: property.breezeway_synced_at,
  };
}
