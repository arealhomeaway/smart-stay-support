/**
 * Breezeway people directory — the identity a Resolve reply is posted under.
 *
 * Breezeway's comment endpoint wants a `company_people_id`. We resolve that
 * deterministically, in this order and no other:
 *
 *   1. The Breezeway person whose email matches the Resolve staff member's own
 *      email. The comment then genuinely comes from that person.
 *   2. The shared "ARHA Resolve" integration identity, with the staff member's
 *      name written into the comment body.
 *
 * There is no third option. Resolve never posts under an unrelated colleague's
 * Breezeway account — that would be impersonation, and the audit trail would
 * lie about who said what.
 */
import { BreezewayError, breezewayRequest } from "./breezeway.server";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

type RawPerson = {
  id?: number;
  first_name?: string | null;
  last_name?: string | null;
  name?: string | null;
  email?: string | null;
  emails?: (string | { email?: string | null })[] | null;
  is_active?: boolean | null;
  active?: boolean | null;
  status?: string | null;
};

function emailOf(p: RawPerson): string | null {
  if (p.email) return p.email.trim().toLowerCase();
  const first = (p.emails ?? [])[0];
  if (!first) return null;
  const value = typeof first === "string" ? first : (first.email ?? null);
  return value ? value.trim().toLowerCase() : null;
}

function namesOf(p: RawPerson) {
  if (p.first_name || p.last_name) {
    return { first: p.first_name ?? null, last: p.last_name ?? null };
  }
  const parts = (p.name ?? "").trim().split(/\s+/);
  return { first: parts[0] ?? null, last: parts.slice(1).join(" ") || null };
}

/**
 * Refreshes the mirrored people list and matches each one to a Resolve user by
 * email. Read-only against Breezeway.
 */
export async function syncBreezewayPeople(): Promise<{
  ok: boolean;
  message?: string;
  people: number;
  matched: number;
  integrationIdentity: number | null;
}> {
  let raw: RawPerson[] = [];
  try {
    let page = 1;
    let pages = 1;
    do {
      const data = await breezewayRequest<RawPerson[] | { results?: RawPerson[]; total_pages?: number }>(
        // Breezeway serves this list at "/people" exactly; "/people/" 404s.
        "/people",
        { params: { limit: 100, page } },
      );
      if (Array.isArray(data)) {
        raw = data;
        break;
      }
      pages = data.total_pages || 1;
      raw.push(...(data.results ?? []));
      page += 1;
    } while (page <= pages && page <= 10);
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof BreezewayError
          ? `Breezeway refused the people read (${error.status}).`
          : "Could not reach Breezeway.",
      people: 0,
      matched: 0,
      integrationIdentity: null,
    };
  }

  const db = await admin();
  const { data: profileData } = await db.from("profiles").select("id, email");
  const byEmail = new Map<string, string>();
  for (const p of (profileData ?? []) as { id: string; email: string | null }[]) {
    if (p.email) byEmail.set(p.email.trim().toLowerCase(), p.id);
  }

  const configuredIntegrationId = Number(process.env["BREEZEWAY_COMMENT_PEOPLE_ID"] ?? "");
  let matched = 0;
  let integrationIdentity: number | null = null;

  for (const person of raw) {
    if (typeof person.id !== "number") continue;
    const email = emailOf(person);
    const { first, last } = namesOf(person);
    const resolveUserId = email ? (byEmail.get(email) ?? null) : null;
    if (resolveUserId) matched += 1;
    const isIntegration =
      (Number.isInteger(configuredIntegrationId) && person.id === configuredIntegrationId) ||
      `${first ?? ""} ${last ?? ""}`.toLowerCase().includes("resolve");
    if (isIntegration) integrationIdentity = person.id;

    await db.from("breezeway_people").upsert(
      {
        breezeway_person_id: person.id,
        first_name: first,
        last_name: last,
        email,
        active:
          person.is_active !== false && person.active !== false && person.status !== "inactive",
        resolve_user_id: resolveUserId,
        mapping_state: resolveUserId ? "matched" : "unmatched",
        is_integration_identity: isIntegration,
        synced_at: new Date().toISOString(),
      } as never,
      { onConflict: "breezeway_person_id" },
    );
  }

  return { ok: true, people: raw.length, matched, integrationIdentity };
}

export type CommentIdentity =
  | { ok: true; peopleId: number; mode: "staff" | "integration"; personName: string | null }
  | { ok: false; message: string };

/** Resolves which Breezeway identity a given Resolve user posts under. */
export async function commentIdentityFor(userId: string): Promise<CommentIdentity> {
  const db = await admin();

  const own = await db
    .from("breezeway_people")
    .select("breezeway_person_id, first_name, last_name, active")
    .eq("resolve_user_id", userId)
    .eq("active", true)
    .maybeSingle();
  const mine = own.data as
    | { breezeway_person_id: number; first_name: string | null; last_name: string | null }
    | null;
  if (mine) {
    return {
      ok: true,
      peopleId: mine.breezeway_person_id,
      mode: "staff",
      personName: [mine.first_name, mine.last_name].filter(Boolean).join(" ") || null,
    };
  }

  const shared = await db
    .from("breezeway_people")
    .select("breezeway_person_id, first_name, last_name")
    .eq("is_integration_identity", true)
    .maybeSingle();
  const integration = shared.data as
    | { breezeway_person_id: number; first_name: string | null; last_name: string | null }
    | null;
  if (integration) {
    return {
      ok: true,
      peopleId: integration.breezeway_person_id,
      mode: "integration",
      personName: [integration.first_name, integration.last_name].filter(Boolean).join(" ") || "ARHA Resolve",
    };
  }

  const fallback = Number(process.env["BREEZEWAY_COMMENT_PEOPLE_ID"] ?? "");
  if (Number.isInteger(fallback) && fallback > 0) {
    return { ok: true, peopleId: fallback, mode: "integration", personName: "ARHA Resolve" };
  }

  return {
    ok: false,
    message:
      "Resolve has no Breezeway identity to post under. Sync the Breezeway people list, or set the shared ARHA Resolve person id.",
  };
}

/** The mapping picture, for the integrations screen. */
export async function breezewayPeopleAudit() {
  const db = await admin();
  const { data } = await db
    .from("breezeway_people")
    .select("breezeway_person_id, first_name, last_name, email, active, resolve_user_id, mapping_state, is_integration_identity, synced_at")
    .order("last_name", { ascending: true, nullsFirst: false });
  const rows = (data ?? []) as {
    breezeway_person_id: number;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    active: boolean;
    resolve_user_id: string | null;
    mapping_state: string;
    is_integration_identity: boolean;
    synced_at: string;
  }[];
  return {
    total: rows.length,
    matched: rows.filter((r) => r.mapping_state === "matched").length,
    integrationIdentity: rows.find((r) => r.is_integration_identity)?.breezeway_person_id ?? null,
    people: rows,
  };
}
