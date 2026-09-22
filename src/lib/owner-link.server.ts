/**
 * Canonical owner linking for a property (server-only).
 *
 * `public.property_owners` is the single owner record set. This module is the
 * only manual way to bind a home to one of those records, so onboarding can be
 * the entry point for owner creation without ever growing a second owner data
 * path. The transitional `property_owner_contacts` table is deliberately not
 * read or written here.
 *
 * Duplicate prevention is the whole point: an owner is matched by email first
 * (case-insensitive), then by exact name, before any new record is created.
 */

import { isStaff, type Viewer } from "./property-hub.server";
import { writeAudit } from "./audit.server";

const DENY = "Only ARHA staff can change the owner of record for a home.";

export type OwnerMatch = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  source: string;
  propertyCount: number;
};

function norm(v: string | null | undefined) {
  return (v ?? "").trim().toLowerCase();
}

async function withCounts(
  rows: {
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
    city: string | null;
    state: string | null;
    source: string;
  }[],
): Promise<OwnerMatch[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  if (rows.length === 0) return [];
  const { data } = await supabaseAdmin
    .from("properties")
    .select("owner_record_id")
    .in(
      "owner_record_id",
      rows.map((r) => r.id),
    )
    .is("archived_at", null);
  const counts = new Map<string, number>();
  for (const p of data ?? []) {
    if (!p.owner_record_id) continue;
    counts.set(p.owner_record_id, (counts.get(p.owner_record_id) ?? 0) + 1);
  }
  return rows.map((r) => ({ ...r, propertyCount: counts.get(r.id) ?? 0 }));
}

/** Staff-only owner lookup used by the "link an existing owner" picker. */
export async function searchOwnerRecords(viewer: Viewer, query: string): Promise<OwnerMatch[]> {
  if (!isStaff(viewer)) throw new Error(DENY);
  const q = query.trim();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  let sel = supabaseAdmin
    .from("property_owners")
    .select("id, name, email, phone, city, state, source")
    .eq("active", true)
    .order("name")
    .limit(20);
  if (q.length >= 2) {
    const like = `%${q.replace(/[%_,]/g, "")}%`;
    sel = sel.or(`name.ilike.${like},email.ilike.${like},phone.ilike.${like}`);
  }
  const { data, error } = await sel;
  if (error) throw error;
  return withCounts(data ?? []);
}

export type LinkOwnerInput = {
  propertyId: string;
  /** Existing canonical owner to bind to. */
  ownerId?: string | null;
  /** Details for an owner that does not exist yet. Matched before creation. */
  newOwner?: {
    name: string;
    email?: string | null;
    phone?: string | null;
    city?: string | null;
    state?: string | null;
    coOwnerName?: string | null;
    coOwnerEmail?: string | null;
    coOwnerPhone?: string | null;
  } | null;
};

export type OwnerCard = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  source: string;
  coOwnerName: string | null;
  coOwnerEmail: string | null;
  coOwnerPhone: string | null;
  propertyCount: number;
};

/** The homeowner shown on a property — one read used by every surface. */
export async function readPropertyOwner(
  viewer: Viewer,
  propertyId: string,
): Promise<{ owner: OwnerCard | null; canManage: boolean }> {
  if (!isStaff(viewer)) throw new Error(DENY);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const property = await supabaseAdmin
    .from("properties")
    .select("id, owner_record_id")
    .eq("id", propertyId)
    .maybeSingle();
  if (property.error) throw property.error;
  const ownerId = property.data?.owner_record_id ?? null;
  if (!ownerId) return { owner: null, canManage: true };

  const rec = await supabaseAdmin
    .from("property_owners")
    .select(
      "id, name, email, phone, city, state, source, co_owner_name, co_owner_email, co_owner_phone",
    )
    .eq("id", ownerId)
    .maybeSingle();
  if (rec.error) throw rec.error;
  if (!rec.data) return { owner: null, canManage: true };

  const { count } = await supabaseAdmin
    .from("properties")
    .select("id", { count: "exact", head: true })
    .eq("owner_record_id", ownerId)
    .is("archived_at", null);

  return {
    owner: {
      id: rec.data.id,
      name: rec.data.name,
      email: rec.data.email,
      phone: rec.data.phone,
      city: rec.data.city,
      state: rec.data.state,
      source: rec.data.source,
      coOwnerName: rec.data.co_owner_name,
      coOwnerEmail: rec.data.co_owner_email,
      coOwnerPhone: rec.data.co_owner_phone,
      propertyCount: count ?? 1,
    },
    canManage: true,
  };
}

/** Edit the canonical owner record in place (staff only, audited). */
export async function updateOwnerRecord(
  viewer: Viewer,
  input: {
    ownerId: string;
    name: string;
    email?: string | null;
    phone?: string | null;
    coOwnerName?: string | null;
    coOwnerEmail?: string | null;
    coOwnerPhone?: string | null;
  },
) {
  if (!isStaff(viewer)) throw new Error(DENY);
  if (!input.name.trim()) throw new Error("The homeowner needs a name.");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const before = await supabaseAdmin
    .from("property_owners")
    .select("id, name, email, phone, co_owner_name, co_owner_email, co_owner_phone")
    .eq("id", input.ownerId)
    .maybeSingle();
  if (before.error) throw before.error;
  if (!before.data) throw new Error("That homeowner record could not be found.");

  const patch = {
    name: input.name.trim(),
    email: input.email?.trim() || null,
    phone: input.phone?.trim() || null,
    co_owner_name: input.coOwnerName?.trim() || null,
    co_owner_email: input.coOwnerEmail?.trim() || null,
    co_owner_phone: input.coOwnerPhone?.trim() || null,
  };
  const upd = await supabaseAdmin
    .from("property_owners")
    .update(patch)
    .eq("id", input.ownerId);
  if (upd.error) throw upd.error;

  await writeAudit({
    actorId: viewer.userId,
    action: "property_owner_updated",
    entityType: "property_owner",
    entityId: input.ownerId,
    entityLabel: patch.name,
    before: before.data,
    after: patch,
  });

  return { ok: true as const, ownerId: input.ownerId };
}

/**
 * Binds a home to exactly one canonical owner record, reusing an existing
 * record whenever the person is already known. Returns whether the owner was
 * created or reused so the caller can say so plainly.
 */
export async function linkPropertyOwner(viewer: Viewer, input: LinkOwnerInput) {
  if (!isStaff(viewer)) throw new Error(DENY);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const property = await supabaseAdmin
    .from("properties")
    .select("id, name, owner_record_id")
    .eq("id", input.propertyId)
    .maybeSingle();
  if (property.error || !property.data) throw new Error("That property could not be found.");

  let ownerId = input.ownerId ?? null;
  let created = false;
  let reused = false;

  if (!ownerId) {
    const nw = input.newOwner;
    if (!nw || !nw.name.trim()) {
      throw new Error("Choose an existing owner or enter the new owner's name.");
    }
    const email = norm(nw.email);
    const name = nw.name.trim();

    // Reuse before create — an owner with more than one home must stay one row.
    const existing = await supabaseAdmin
      .from("property_owners")
      .select("id, name, email")
      .eq("active", true);
    if (existing.error) throw existing.error;
    // Match on name, not email alone: ARHA owners routinely hold several
    // distinct LLC entities under one personal email, so an email-only match
    // would fold real, separate owner records together. An email hit only
    // counts as the same owner when the name matches too.
    const match = (existing.data ?? []).find(
      (o) => norm(o.name) === norm(name) && (!email || !o.email || norm(o.email) === email),
    );

    if (match) {
      ownerId = match.id;
      reused = true;
    } else {
      const ins = await supabaseAdmin
        .from("property_owners")
        .insert({
          source: "resolve",
          source_owner_id: crypto.randomUUID(),
          name,
          email: nw.email?.trim() || null,
          phone: nw.phone?.trim() || null,
          city: nw.city?.trim() || null,
          state: nw.state?.trim() || null,
        })
        .select("id")
        .single();
      if (ins.error) throw ins.error;
      ownerId = ins.data.id;
      created = true;
    }
  }

  const upd = await supabaseAdmin
    .from("properties")
    .update({ owner_record_id: ownerId })
    .eq("id", input.propertyId);
  if (upd.error) throw upd.error;

  await writeAudit({
    actorId: viewer.userId,
    action: created ? "property_owner_created_and_linked" : "property_owner_linked",
    entityType: "property",
    entityId: input.propertyId,
    entityLabel: property.data.name,
    before: { ownerRecordId: property.data.owner_record_id },
    after: { ownerRecordId: ownerId, created, reused },
  });

  return { ok: true as const, ownerId: ownerId!, created, reused };
}
