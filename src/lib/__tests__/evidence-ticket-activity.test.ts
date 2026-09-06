/**
 * Regression tests for evidence reaching a satisfied state writing into
 * `ticket_activity` — so a reviewer reading the ticket's history actually
 * sees when evidence showed up, not just the technical evidence log.
 *
 * `evidence.server.ts` also imports the "ai" package (photo quality checks)
 * which isn't resolvable in this sandbox; "ai" and its gateway wrapper are
 * stubbed purely so the module can load — nothing under test calls them.
 * Everything else runs against the in-memory store in
 * fakeEvidenceSupabase.ts — no real database, no real AI call.
 */
import { beforeEach, describe, expect, it, mock } from "bun:test";
import { createFakeEvidenceStore } from "./fakeEvidenceSupabase";

const store = createFakeEvidenceStore();
mock.module("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: store.supabaseAdmin,
}));
mock.module("ai", () => ({ generateText: async () => ({ text: "" }) }));
mock.module("@/lib/ai-gateway.server", () => ({
  createLovableAiGatewayProvider: () => ({}),
  COACH_MODEL: "test-model",
}));

const { acceptWithException } = await import("@/lib/evidence.server");

const TICKET = "11111111-1111-4111-8111-111111111111";
const SUPERVISOR = { userId: "sup-1", name: "Jordan Ruiz", isSupervisor: true };
const TECH = { userId: "tech-1", name: "Alex Chen", isSupervisor: false };

function seedRequirement(overrides: Record<string, unknown> = {}) {
  const req = {
    id: `req-${store.state.nextId++}`,
    subject_type: "ticket",
    subject_id: TICKET,
    label: "Water heater serial",
    status: "rejected",
    ...overrides,
  };
  store.state.evidenceRequirements.push(req);
  return req;
}

function seedItem(requirementId: string, overrides: Record<string, unknown> = {}) {
  const item = {
    id: `item-${store.state.nextId++}`,
    requirement_id: requirementId,
    status: "rejected",
    guidance: "Photo was too dark to confirm the serial.",
    reason_codes: ["too_dark"],
    ...overrides,
  };
  store.state.evidenceItems.push(item);
  return item;
}

beforeEach(() => store.reset());

describe("acceptWithException — evidence reaching a satisfied state writes ticket_activity", () => {
  it("writes one evidence_requirement_satisfied entry, worded for an exception", async () => {
    const req = seedRequirement();
    const item = seedItem(req.id as string);

    const result = await acceptWithException(
      SUPERVISOR,
      item.id as string,
      "Vendor confirmed by phone — no light in the crawl space to retake it.",
    );

    expect(result.ok).toBe(true);
    expect(store.ticketActivity().length).toBe(1);
    const activity = store.ticketActivity()[0]!;
    expect(activity["ticket_id"]).toBe(TICKET);
    expect(activity["kind"]).toBe("evidence");
    expect(activity["event_type"]).toBe("evidence_requirement_satisfied");
    expect(String(activity["body"])).toContain("exception");

    expect(store.evidenceRequirements()[0]!["status"]).toBe("accepted_exception");
    expect(store.evidenceItems()[0]!["status"]).toBe("accepted_exception");
  });

  it("never writes a second entry once the requirement is already satisfied", async () => {
    // Already satisfied by an earlier, unrelated verified item.
    const req = seedRequirement({ status: "verified" });
    seedItem(req.id as string, { status: "verified" });
    const second = seedItem(req.id as string, { status: "rejected" });

    const result = await acceptWithException(SUPERVISOR, second.id as string, "Second pass, fine.");

    expect(result.ok).toBe(true);
    // The requirement was already satisfied before this call — no new
    // "reached satisfied" moment, so no new activity entry.
    expect(store.ticketActivity().length).toBe(0);
  });

  it("never writes to ticket_activity for a non-ticket subject", async () => {
    const req = seedRequirement({ subject_type: "guest_recovery", subject_id: "rec-1" });
    const item = seedItem(req.id as string);

    await acceptWithException(SUPERVISOR, item.id as string, "Confirmed with the guest directly.");

    expect(store.ticketActivity().length).toBe(0);
  });

  it("refuses a non-supervisor and writes nothing", async () => {
    const req = seedRequirement();
    const item = seedItem(req.id as string);

    const result = await acceptWithException(TECH, item.id as string, "Looks fine to me honestly.");

    expect(result.ok).toBe(false);
    expect(store.ticketActivity().length).toBe(0);
    expect(store.evidenceItems()[0]!["status"]).toBe("rejected");
  });
});
