import { z } from "zod";

// Shape of a coaching result. Client-safe: no server imports.
export const GuidanceSchema = z.object({
  read_back: z.string(),
  situation_type: z.string(),
  category: z.string(),
  work_type_name: z.string(),
  priority: z.enum(["p1", "p2", "p3"]),
  priority_reason: z.string(),
  guest_impact: z.enum(["none", "minor", "active_guest_affected", "safety_security"]),
  occupancy_status: z.enum(["vacant", "occupied", "same_day_arrival", "same_day_departure"]),
  suggested_title: z.string(),
  risk_flags: z.array(z.object({ title: z.string(), why: z.string() })),
  clarifying_questions: z.array(z.string()),
  immediate_actions: z.array(z.string()),
  steps: z.array(
    z.object({
      instruction: z.string(),
      detail: z.string(),
      required: z.boolean(),
      photo_required: z.boolean(),
    }),
  ),
  vendor_brief: z.object({
    scope: z.string(),
    must_check: z.array(z.string()),
    must_not_do: z.array(z.string()),
    evidence_required: z.array(z.string()),
    before_leaving: z.array(z.string()),
  }),
  guest_message: z.string(),
  owner_note: z.string(),
  escalate_if: z.array(z.string()),
});

export type Guidance = z.infer<typeof GuidanceSchema>;

