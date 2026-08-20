import { generateText } from "ai";
import { RawGuidanceSchema, normalizeGuidance, type Guidance } from "./coach-schema";
import { COACH_MODEL, createLovableAiGatewayProvider } from "./ai-gateway.server";

// The coach never invents policy. Everything it says has to trace back to the
// ARHA SOP: the mechanical priority rubric, the work type catalog and the
// playbook library that already live in the database.

const SYSTEM = `You are "Resolve Coach", the operations coach for A Real Home Away (ARHA), a short- and mid-term rental management company. You coach Property Coordinators (PCs) through live situations so nothing gets missed and risk is contained.

Non-negotiable house rules, taken from the ARHA Property Coordinator SOP:
- Priorities are P1 (critical, acknowledge in 3 minutes, act within 5), P2 (time-sensitive, must move today), P3 (standard planned work). Never invent other priorities.
- The mechanical rubric decides priority: the work type suggests a floor, then guest impact and occupancy status can only raise it. Safety or security issues, and anything affecting an active guest, are P1. A same-day arrival is at least P2, P1 when the guest is affected.
- The property determines the Pod; priority and time determine who acts.
- A handoff is not complete until it is accepted. The original owner stays responsible until then.
- Vendors and handymen must never be given a vague scope. Every dispatch brief states what to check, what NOT to do, and what evidence to bring back.
- A device that is removed must be replaced the same visit. Never leave a home without a working smoke alarm or CO alarm, and never leave an unrepaired hole, exposed wiring or an open water line.
- Any alarm complaint means checking every smoke alarm, every CO alarm and the security system in the home, not just the one the guest points at. A repeating chirp or alarm with no obvious source is treated as a possible CO event: get people to fresh air and call 911 / the fire department before troubleshooting.
- Water: shut off the local supply first, then the main if needed. Photograph before and after. Look for damage below and behind the leak, and check for a water heater, appliance or slab source before calling it fixed.
- Close nothing until the guest has confirmed the fix and required evidence is attached.

Coaching style: direct, calm, specific to this home and this guest. Short imperative sentences a coordinator can read aloud. Never generic filler. If information is missing that would change the priority or the dispatch, ask for it in clarifying_questions instead of assuming.

Output rules:
- Choose work_type_name from the provided catalog exactly as written when one fits; otherwise use the closest catalog name.
- checklist: the checklist the coordinator works, in order. Start from the matching playbook's steps when one is provided, then add situation-specific steps. Mark required=true for anything that protects safety, the guest or ARHA's liability, and photo_required=true where proof matters.
- immediate_actions: only what must happen in the next few minutes.
- vendor_brief: written to be pasted straight to the handyman or vendor. must_not_do always includes the failure modes for this kind of job.
- guest_message: a ready-to-send message in ARHA's voice — warm, accountable, concrete, no excuses, includes what happens next and when.
- Keep each list to the few items that matter. No more than about 8 per list.
- Return EVERY key, always, with real content: read_back, situation_type, category, work_type_name, priority, priority_reason, guest_impact, occupancy_status, suggested_title, risk_flags, clarifying_questions, immediate_actions, checklist, vendor_brief (scope, must_check, must_not_do, evidence_required, before_leaving), guest_message, owner_note, escalate_if. Never leave a list empty and never write "N/A". checklist must always contain the full ordered checklist (at least 5 steps). When there is no guest in the home, guest_message is the message to send the owner-facing point of contact or the next arriving guest if the issue could affect them.`;

type Catalog = {
  workTypes: {
    name: string;
    category: string;
    bucket: string | null;
    default_priority: string | null;
    response_minutes: number | null;
    action_start_minutes: number | null;
    required_closure_evidence?: string | null;
    operating_standard?: string | null;
  }[];
  playbooks: { title: string; category: string; summary: string | null; steps: string[] }[];
  property?: {
    name: string;
    nickname?: string | null;
    address?: string | null;
    access_notes?: string | null;
    equipment_notes?: string | null;
    wifi_notes?: string | null;
    parking_notes?: string | null;
    notes?: string | null;
  } | null;
  occupancyHint?: string | null;
  guestName?: string | null;
  history?: { title: string; category: string; priority: string; outcome: string | null }[];
};

function contextBlock(catalog: Catalog) {
  const lines: string[] = [];
  lines.push("WORK TYPE CATALOG (name — category — suggested priority — response/action minutes):");
  for (const w of catalog.workTypes) {
    lines.push(
      `- ${w.name} — ${w.category} — ${w.default_priority ?? "p3"} — ${w.response_minutes ?? "?"}m / ${
        w.action_start_minutes ?? "?"
      }m${w.required_closure_evidence ? ` — closure evidence: ${w.required_closure_evidence}` : ""}${
        w.operating_standard ? ` — standard: ${w.operating_standard}` : ""
      }`,
    );
  }
  lines.push("", "PLAYBOOK LIBRARY:");
  for (const p of catalog.playbooks) {
    lines.push(`- ${p.title} (${p.category})${p.summary ? `: ${p.summary}` : ""}`);
    for (const s of p.steps) lines.push(`    • ${s}`);
  }
  if (catalog.property) {
    const p = catalog.property;
    lines.push("", "THIS PROPERTY:");
    lines.push(`- Name: ${p.name}${p.nickname ? ` (${p.nickname})` : ""}`);
    if (p.address) lines.push(`- Address: ${p.address}`);
    if (p.access_notes) lines.push(`- Access: ${p.access_notes}`);
    if (p.equipment_notes) lines.push(`- Equipment / shutoffs: ${p.equipment_notes}`);
    if (p.parking_notes) lines.push(`- Parking: ${p.parking_notes}`);
    if (p.wifi_notes) lines.push(`- Wi-Fi: ${p.wifi_notes}`);
    if (p.notes) lines.push(`- Notes: ${p.notes}`);
  }
  if (catalog.occupancyHint) {
    lines.push("", `LIVE OCCUPANCY (from the booking system): ${catalog.occupancyHint}`);
    if (catalog.guestName) lines.push(`Guest on the reservation: ${catalog.guestName}`);
  }
  if (catalog.history?.length) {
    lines.push("", "RECENT HISTORY AT THIS HOME:");
    for (const h of catalog.history) {
      lines.push(`- [${h.priority.toUpperCase()}] ${h.title} (${h.category})${h.outcome ? ` → ${h.outcome}` : ""}`);
    }
  }
  return lines.join("\n");
}

function gateway() {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("AI is not configured for this workspace.");
  return createLovableAiGatewayProvider(key);
}

const JSON_SHAPE = `Reply with ONLY a JSON object, no prose and no code fence, in exactly this shape:
{
  "read_back": string,
  "situation_type": string,
  "category": string,
  "work_type_name": string,
  "priority": "p1" | "p2" | "p3",
  "priority_reason": string,
  "guest_impact": "none" | "minor" | "active_guest_affected" | "safety_security",
  "occupancy_status": "vacant" | "occupied" | "same_day_arrival" | "same_day_departure",
  "suggested_title": string,
  "risk_flags": [{ "title": string, "why": string }],
  "clarifying_questions": [string],
  "immediate_actions": [string],
  "checklist": [{ "instruction": string, "detail": string, "required": boolean, "photo_required": boolean }],
  "vendor_brief": { "scope": string, "must_check": [string], "must_not_do": [string], "evidence_required": [string], "before_leaving": [string] },
  "guest_message": string,
  "owner_note": string,
  "escalate_if": [string]
}`;

function parseGuidanceText(text: string, question: string): Guidance {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("The coach returned an unreadable answer. Try again.");
  const raw = RawGuidanceSchema.parse(JSON.parse(text.slice(start, end + 1)));
  return normalizeGuidance(raw, question);
}

export async function generateGuidance(question: string, catalog: Catalog): Promise<Guidance> {
  const provider = gateway();
  const { text } = await generateText({
    model: provider(COACH_MODEL),
    system: SYSTEM,
    maxOutputTokens: 5000,
    prompt: `${contextBlock(catalog)}\n\nTHE COORDINATOR TYPED:\n"""${question}"""\n\nCoach them through it.\n\n${JSON_SHAPE}`,
  });
  return parseGuidanceText(text, question);
}


export async function answerFollowUp(input: {
  question: string;
  priorQuestion: string;
  guidance: unknown;
  history: { role: "user" | "assistant"; content: string }[];
  catalog: Catalog;
}) {
  const provider = gateway();
  const { text } = await generateText({
    model: provider(COACH_MODEL),
    system: `${SYSTEM}\n\nYou are now answering follow-up questions about a situation you already coached. Answer in short markdown: a direct answer first, then only the steps that change. Never repeat the whole plan.`,
    messages: [
      {
        role: "user" as const,
        content: `${contextBlock(input.catalog)}\n\nORIGINAL SITUATION:\n"""${input.priorQuestion}"""\n\nGUIDANCE ALREADY GIVEN (JSON):\n${JSON.stringify(input.guidance)}`,
      },
      { role: "assistant" as const, content: "Understood. I have the plan in front of me." },
      ...input.history,
      { role: "user" as const, content: input.question },
    ],
  });
  return text;
}
