/**
 * Server functions for the Evidence Quality Gate.
 *
 * Thin wrappers. Every decision — who may submit, whether a photo passes, who
 * may override — is made in evidence.server.ts, which re-checks the caller.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { EVIDENCE_KINDS, EVIDENCE_SUBJECTS, type EvidenceKind, type EvidenceSubject } from "@/lib/evidence";

async function actorFor(supabase: SupabaseClient<Database>, userId: string) {
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (error) throw new Error("Could not confirm your access level.");
  const roles = (data ?? []).map((r) => r.role as string);
  const staff = roles.some((r) => ["admin", "manager", "onboarding", "tech"].includes(r));
  if (!staff) throw new Error("Only Resolve staff can work with evidence.");
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", userId)
    .maybeSingle();
  const p = profile as { full_name: string | null; email: string | null } | null;
  return {
    userId,
    name: p?.full_name || p?.email || "Resolve staff",
    isSupervisor: roles.some((r) => r === "admin" || r === "manager"),
  };
}

function uuid(value: unknown, label = "record") {
  const id = String(value ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error(`Invalid ${label} reference.`);
  return id;
}

function subject(value: unknown): EvidenceSubject {
  const s = String(value ?? "");
  if (!(EVIDENCE_SUBJECTS as readonly string[]).includes(s)) throw new Error("Unknown record type.");
  return s as EvidenceSubject;
}

export const evidenceForRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { subjectType: string; subjectId: string }) => ({
    subjectType: subject(input?.subjectType),
    subjectId: uuid(input?.subjectId),
  }))
  .handler(async ({ data, context }) => {
    const actor = await actorFor(context.supabase, context.userId);
    const m = await import("@/lib/evidence.server");
    const [requirements, completeness] = await Promise.all([
      m.listRequirements(data.subjectType, data.subjectId),
      m.evidenceComplete(data.subjectType, data.subjectId),
    ]);
    return { requirements, completeness, canOverride: actor.isSupervisor };
  });

export const addEvidenceRequirementFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      subjectType: string;
      subjectId: string;
      propertyId?: string | null;
      slotKey: string;
      label?: string;
      kind: string;
      instruction?: string | null;
      detail?: string | null;
      required?: boolean;
    }) => {
      const kind = String(input?.kind ?? "general");
      if (!(EVIDENCE_KINDS as readonly string[]).includes(kind)) throw new Error("Unknown evidence type.");
      const slotKey = String(input?.slotKey ?? "").trim().slice(0, 60);
      if (!slotKey) throw new Error("Give the evidence request a short key.");
      return {
        subjectType: subject(input?.subjectType),
        subjectId: uuid(input?.subjectId),
        propertyId: input?.propertyId ? uuid(input.propertyId, "property") : null,
        slotKey,
        label: input?.label ? String(input.label).slice(0, 120) : undefined,
        kind: kind as EvidenceKind,
        instruction: input?.instruction ? String(input.instruction).slice(0, 500) : null,
        detail: input?.detail ? String(input.detail).slice(0, 200) : null,
        required: input?.required !== false,
      };
    },
  )
  .handler(async ({ data, context }) => {
    const actor = await actorFor(context.supabase, context.userId);
    const m = await import("@/lib/evidence.server");
    return m.ensureRequirements(
      data.subjectType,
      data.subjectId,
      data.propertyId,
      [
        {
          slotKey: data.slotKey,
          label: data.label,
          kind: data.kind,
          instruction: data.instruction,
          detail: data.detail,
          required: data.required,
        },
      ],
      actor.userId,
    );
  });

export const removeEvidenceRequirementFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { requirementId: string }) => ({
    requirementId: uuid(input?.requirementId, "evidence request"),
  }))
  .handler(async ({ data, context }) => {
    const actor = await actorFor(context.supabase, context.userId);
    if (!actor.isSupervisor) throw new Error("Only a supervisor can remove an evidence request.");
    const m = await import("@/lib/evidence.server");
    await m.removeRequirement(data.requirementId);
    return { ok: true as const };
  });

/** Puts an already-uploaded file through the gate. */
export const submitEvidenceFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { requirementId: string; documentId: string }) => ({
    requirementId: uuid(input?.requirementId, "evidence request"),
    documentId: uuid(input?.documentId, "file"),
  }))
  .handler(async ({ data, context }) => {
    const actor = await actorFor(context.supabase, context.userId);
    const m = await import("@/lib/evidence.server");
    return m.submitEvidence(actor, {
      requirementId: data.requirementId,
      documentId: data.documentId,
      source: "resolve_upload",
    });
  });

export const recheckEvidenceFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { itemId: string }) => ({ itemId: uuid(input?.itemId, "photo") }))
  .handler(async ({ data, context }) => {
    const actor = await actorFor(context.supabase, context.userId);
    const m = await import("@/lib/evidence.server");
    return m.recheckEvidence(actor, data.itemId);
  });

export const acceptEvidenceExceptionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { itemId: string; reason: string }) => ({
    itemId: uuid(input?.itemId, "photo"),
    reason: String(input?.reason ?? "").trim().slice(0, 800),
  }))
  .handler(async ({ data, context }) => {
    const actor = await actorFor(context.supabase, context.userId);
    const m = await import("@/lib/evidence.server");
    return m.acceptWithException(actor, data.itemId, data.reason);
  });

export const evidenceQualityStatsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { windowDays?: number }) => ({
    windowDays: Math.min(365, Math.max(7, Number(input?.windowDays ?? 30) || 30)),
  }))
  .handler(async ({ data, context }) => {
    await actorFor(context.supabase, context.userId);
    const m = await import("@/lib/evidence.server");
    return m.evidenceQualityStats(data.windowDays);
  });
