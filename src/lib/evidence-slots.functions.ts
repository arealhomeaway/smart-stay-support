/**
 * Creates the evidence checklist for a newly logged refund/credit or claim.
 *
 * Staff have no direct insert right on evidence_requirements (only the server
 * evidence engine writes it), so the browser hands the new record here. The
 * caller must be staff and must be the creator of that record, and the record
 * must have no checklist yet. If the checklist cannot be saved, the new record
 * is removed so a refund or claim never saves half-way.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SlotInput = {
  slot_key: string;
  label: string;
  requirement_kind: string;
  instruction: string | null;
  required: boolean;
};

type Input = {
  subjectType: "guest_recovery" | "claim";
  subjectId: string;
  slots: SlotInput[];
};

const TABLE = { guest_recovery: "guest_recovery", claim: "claims" } as const;

export function validateSlotInput(raw: unknown): Input {
  const d = (raw ?? {}) as { subjectType?: unknown; subjectId?: unknown; slots?: unknown };
  if (d.subjectType !== "guest_recovery" && d.subjectType !== "claim")
    throw new Error("Unknown record type.");
  const id = String(d.subjectId ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Invalid record reference.");
  if (!Array.isArray(d.slots) || d.slots.length > 30) throw new Error("Invalid checklist.");
  const slots = d.slots.map((s) => {
    const o = s as { slot_key?: unknown; label?: unknown; requirement_kind?: unknown; instruction?: unknown; required?: unknown };
    if (typeof o.slot_key !== "string" || typeof o.label !== "string" || typeof o.requirement_kind !== "string")
      throw new Error("Invalid checklist item.");
    return {
      slot_key: o.slot_key.slice(0, 80),
      label: o.label.slice(0, 200),
      requirement_kind: o.requirement_kind.slice(0, 40),
      instruction: typeof o.instruction === "string" ? o.instruction.slice(0, 1000) : null,
      required: o.required !== false,
    };
  });
  return { subjectType: d.subjectType, subjectId: id, slots };
}

export const createEvidenceSlotsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateSlotInput)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const roles = await supabase.from("user_roles").select("role").eq("user_id", userId);
    if (roles.error) throw new Error("Could not confirm your access level.");
    const staff = (roles.data ?? []).some((r) =>
      ["admin", "manager", "onboarding", "tech"].includes(r.role as string),
    );
    if (!staff) throw new Error("Only Resolve staff can log this.");

    // Read as the caller so normal access rules apply.
    const table = TABLE[data.subjectType];
    const subject = await supabase
      .from(table)
      .select("id, property_id, created_by")
      .eq("id", data.subjectId)
      .maybeSingle();
    const row = subject.data as { id: string; property_id: string | null; created_by: string | null } | null;
    if (subject.error || !row) throw new Error("Could not find the record you just saved.");
    if (row.created_by !== userId) throw new Error("Only the person who logged this can set up its checklist.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const existing = await supabaseAdmin
      .from("evidence_requirements")
      .select("id", { count: "exact", head: true })
      .eq("subject_type", data.subjectType)
      .eq("subject_id", row.id);
    if (existing.error) throw new Error("Could not check the evidence checklist.");
    if ((existing.count ?? 0) > 0 || data.slots.length === 0) return { created: 0 };

    const { error } = await supabaseAdmin.from("evidence_requirements").insert(
      data.slots.map((s) => ({
        ...s,
        subject_type: data.subjectType,
        subject_id: row.id,
        property_id: row.property_id,
        status: "awaiting",
        created_by: userId,
      })) as never,
    );
    if (error) {
      // Undo the new record so nothing is left half-saved.
      await supabaseAdmin.from(table).delete().eq("id", row.id).eq("created_by", userId);
      throw new Error("The evidence checklist could not be saved, so nothing was logged. Please try again.");
    }
    return { created: data.slots.length };
  });
