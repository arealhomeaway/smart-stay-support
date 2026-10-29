import { formatPropertyLabel } from "@/lib/property-label";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { HomeownerEnrollment, HomeownerRow } from "./homeowners";

type Client = SupabaseClient<Database>;

function daysBetween(from: Date, to: Date) {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

/** Every homeowner we know of, with homes, login status and program standing. */
export async function loadHomeowners(supabase: Client): Promise<{ rows: HomeownerRow[] }> {
  const [owners, properties, contacts, programs] = await Promise.all([
    supabase.from("property_owners").select("id, name, email, phone, active").eq("active", true),
    supabase.from("properties").select("id, name, owner_record_id, is_demo, nickname, address_line1, unit, city, state, postal_code, ownerrez_property_id").eq("active", true),
    supabase
      .from("property_owner_contacts")
      .select("id, property_id, owner_name, owner_email, owner_phone"),
    supabase
      .from("owner_programs")
      .select("id, owner_record_id, owner_email, owner_user_id, status, ends_on")
      .is("archived_at", null),
  ]);

  for (const r of [owners, properties, contacts, programs]) {
    if (r.error) throw r.error;
  }

  const homesByOwner = new Map<string, { id: string; name: string }[]>();
  const homeById = new Map<string, { id: string; name: string }>();
  for (const p of properties.data ?? []) {
    homeById.set(p.id, { id: p.id, name: formatPropertyLabel(p).primary });
    if (!p.owner_record_id) continue;
    const list = homesByOwner.get(p.owner_record_id) ?? [];
    list.push({ id: p.id, name: formatPropertyLabel(p).primary });
    homesByOwner.set(p.owner_record_id, list);
  }

  const today = new Date();
  type ProgramInfo = { id: string; enrollment: HomeownerEnrollment; daysLeft: number | null; linked: boolean };
  const byOwnerRecord = new Map<string, ProgramInfo>();
  const byEmail = new Map<string, ProgramInfo>();
  for (const prog of programs.data ?? []) {
    const enrollment: HomeownerEnrollment =
      prog.status === "completed" ? "completed" : prog.status === "active" ? "enrolled" : "not_enrolled";
    const info: ProgramInfo = {
      id: prog.id,
      enrollment,
      daysLeft: prog.ends_on ? Math.max(0, daysBetween(today, new Date(prog.ends_on))) : null,
      linked: Boolean(prog.owner_user_id),
    };
    if (prog.owner_record_id) byOwnerRecord.set(prog.owner_record_id, info);
    if (prog.owner_email) byEmail.set(prog.owner_email.toLowerCase(), info);
  }

  const rows: HomeownerRow[] = [];
  const seenEmails = new Set<string>();

  for (const o of owners.data ?? []) {
    const email = o.email?.trim() || null;
    const program = byOwnerRecord.get(o.id) ?? (email ? byEmail.get(email.toLowerCase()) : undefined);
    if (email) seenEmails.add(email.toLowerCase());
    rows.push({
      id: o.id,
      name: o.name ?? "Unnamed owner",
      email,
      phone: o.phone?.trim() || null,
      ownerType: "primary",
      properties: homesByOwner.get(o.id) ?? [],
      hasLogin: program?.linked ?? false,
      enrollment: program?.enrollment ?? "not_enrolled",
      programId: program?.id ?? null,
      daysLeft: program?.daysLeft ?? null,
    });
  }

  // Extra contacts captured against a property (second owners, spouses, LLC
  // signers) that are not their own owner record.
  const contactByKey = new Map<string, HomeownerRow>();
  for (const c of contacts.data ?? []) {
    const email = c.owner_email?.trim() || null;
    const key = (email ?? c.owner_name ?? c.id).toLowerCase();
    if (email && seenEmails.has(email.toLowerCase())) continue;
    const home = homeById.get(c.property_id);
    const existing = contactByKey.get(key);
    if (existing) {
      if (home && !existing.properties.some((p) => p.id === home.id)) existing.properties.push(home);
      continue;
    }
    const program = email ? byEmail.get(email.toLowerCase()) : undefined;
    contactByKey.set(key, {
      id: c.id,
      name: c.owner_name ?? "Unnamed contact",
      email,
      phone: c.owner_phone?.trim() || null,
      ownerType: "secondary",
      properties: home ? [home] : [],
      hasLogin: program?.linked ?? false,
      enrollment: program?.enrollment ?? "not_enrolled",
      programId: program?.id ?? null,
      daysLeft: program?.daysLeft ?? null,
    });
  }

  return { rows: [...rows, ...contactByKey.values()] };
}
