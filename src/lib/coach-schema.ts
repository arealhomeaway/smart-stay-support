import { z } from "zod";

// Shape of a coaching result. Client-safe: no server imports.
// The raw schema is deliberately forgiving — models drop or null fields — and
// normalizeGuidance() fills the gaps so the UI always renders a full plan.

const str = z.string().nullish();
const list = <T extends z.ZodTypeAny>(item: T) => z.array(item).nullish();

export const RawGuidanceSchema = z.object({
  read_back: str,
  situation_type: str,
  category: str,
  work_type_name: str,
  priority: z.enum(["p1", "p2", "p3"]).nullish(),
  priority_reason: str,
  guest_impact: z.enum(["none", "minor", "active_guest_affected", "safety_security"]).nullish(),
  occupancy_status: z.enum(["vacant", "occupied", "same_day_arrival", "same_day_departure"]).nullish(),
  suggested_title: str,
  risk_flags: list(z.object({ title: str, why: str })),
  clarifying_questions: list(z.string()),
  immediate_actions: list(z.string()),
  steps: list(
    z.object({
      instruction: str,
      detail: str,
      required: z.boolean().nullish(),
      photo_required: z.boolean().nullish(),
    }),
  ),
  vendor_brief: z
    .object({
      scope: str,
      must_check: list(z.string()),
      must_not_do: list(z.string()),
      evidence_required: list(z.string()),
      before_leaving: list(z.string()),
    })
    .nullish(),
  guest_message: str,
  owner_note: str,
  escalate_if: list(z.string()),
});

export type RawGuidance = z.infer<typeof RawGuidanceSchema>;

export type Guidance = {
  read_back: string;
  situation_type: string;
  category: string;
  work_type_name: string;
  priority: "p1" | "p2" | "p3";
  priority_reason: string;
  guest_impact: "none" | "minor" | "active_guest_affected" | "safety_security";
  occupancy_status: "vacant" | "occupied" | "same_day_arrival" | "same_day_departure";
  suggested_title: string;
  risk_flags: { title: string; why: string }[];
  clarifying_questions: string[];
  immediate_actions: string[];
  steps: { instruction: string; detail: string; required: boolean; photo_required: boolean }[];
  vendor_brief: {
    scope: string;
    must_check: string[];
    must_not_do: string[];
    evidence_required: string[];
    before_leaving: string[];
  };
  guest_message: string;
  owner_note: string;
  escalate_if: string[];
};

const clean = (v: string | null | undefined, fallback = "") => (v ?? "").trim() || fallback;
const cleanList = (v: (string | null | undefined)[] | null | undefined) =>
  (v ?? []).map((i) => clean(i)).filter(Boolean);

export function normalizeGuidance(raw: RawGuidance, question: string): Guidance {
  return {
    read_back: clean(raw.read_back, question),
    situation_type: clean(raw.situation_type, "Operational issue"),
    category: clean(raw.category, "maintenance"),
    work_type_name: clean(raw.work_type_name, "Unclassified work"),
    priority: raw.priority ?? "p2",
    priority_reason: clean(raw.priority_reason, "Priority set from the mechanical rubric."),
    guest_impact: raw.guest_impact ?? "none",
    occupancy_status: raw.occupancy_status ?? "vacant",
    suggested_title: clean(raw.suggested_title, question.slice(0, 80)),
    risk_flags: (raw.risk_flags ?? [])
      .map((r) => ({ title: clean(r.title), why: clean(r.why) }))
      .filter((r) => r.title || r.why),
    clarifying_questions: cleanList(raw.clarifying_questions),
    immediate_actions: cleanList(raw.immediate_actions),
    steps: (raw.steps ?? [])
      .map((s) => ({
        instruction: clean(s.instruction),
        detail: clean(s.detail),
        required: s.required ?? true,
        photo_required: s.photo_required ?? false,
      }))
      .filter((s) => s.instruction),
    vendor_brief: {
      scope: clean(raw.vendor_brief?.scope),
      must_check: cleanList(raw.vendor_brief?.must_check),
      must_not_do: cleanList(raw.vendor_brief?.must_not_do),
      evidence_required: cleanList(raw.vendor_brief?.evidence_required),
      before_leaving: cleanList(raw.vendor_brief?.before_leaving),
    },
    guest_message: clean(raw.guest_message),
    owner_note: clean(raw.owner_note),
    escalate_if: cleanList(raw.escalate_if),
  };
}
