import { describe, expect, it } from "bun:test";
import { matchPlaybook, NO_APPROVED_GUIDANCE, type MatchContext } from "@/lib/playbook-match";
import { driftWarnings, hasAuthoredGuidance, parsePlaybook, type PlaybookRow } from "@/lib/playbooks";

function pb(overrides: Partial<PlaybookRow> & { id: string; title: string }): ReturnType<typeof parsePlaybook> {
  return parsePlaybook({
    category: "other",
    status: "active",
    applies_to: ["ticket"],
    ...overrides,
  } as PlaybookRow);
}

const leak = pb({
  id: "leak",
  title: "Active leak / water damage",
  category: "water",
  playbook_key: "water_active_leak",
  matcher: { categories: ["water"], priorities: ["p1"], requires: ["guest_in_home"] },
  risk_flags: [{ title: "Water can reach the unit below", why: "Check the ceiling downstairs before leaving." }],
  immediate_actions: ["Shut the water off at the source before anything else."],
  escalate_if: ["Water reaches a neighbouring unit."],
});

const hvac = pb({
  id: "hvac",
  title: "No heat / no cooling",
  category: "hvac",
  playbook_key: "hvac_no_conditioning",
  matcher: { work_types: ["No heat / no cooling"] },
  immediate_actions: ["Confirm the thermostat and breaker before dispatching."],
});

const vendor = pb({
  id: "vendor",
  title: "Vendor dispatch and quote approval",
  category: "maintenance",
  playbook_key: "vendor_dispatch",
  matcher: { objects: ["ticket", "work_order"], requires: ["owner_approval_required"] },
  vendor_brief: { scope: "Diagnose and quote", must_not_do: ["Start work before approval"] },
});

const librarySteps = pb({
  id: "library",
  title: "Quarterly property review",
  category: "other",
  playbook_key: "quarterly_review",
});

const retired = pb({
  id: "retired",
  title: "Old leak process",
  category: "water",
  status: "retired",
  playbook_key: "water_active_leak_old",
  matcher: { categories: ["water"] },
  immediate_actions: ["Call the old number."],
});

const ALL = [leak, hvac, vendor, librarySteps, retired];

const base: MatchContext = { objectType: "ticket" };

describe("matchPlaybook", () => {
  it("matches a P1 leak with a guest in the home", () => {
    const r = matchPlaybook(ALL, { ...base, category: "water", priority: "p1", guestInHome: true });
    expect(r.primary?.playbook.playbook_key).toBe("water_active_leak");
    expect(r.hasApprovedGuidance).toBe(true);
    expect(r.primary?.reason).toContain("a guest is in the home");
  });

  it("does not match the leak playbook when its required condition is absent", () => {
    const r = matchPlaybook(ALL, { ...base, category: "water", priority: "p1", guestInHome: false });
    expect(r.primary).toBeNull();
  });

  it("never surfaces a retired playbook", () => {
    const r = matchPlaybook([retired], { ...base, category: "water" });
    expect(r.primary).toBeNull();
  });

  it("ignores a playbook with no matcher — a library entry is not contextual", () => {
    const r = matchPlaybook([librarySteps], { ...base, category: "other" });
    expect(r.primary).toBeNull();
  });

  it("matches work type by name, case-insensitively", () => {
    const r = matchPlaybook(ALL, { ...base, workTypeName: "no heat / no cooling" });
    expect(r.primary?.playbook.playbook_key).toBe("hvac_no_conditioning");
  });

  it("respects the object type a playbook applies to", () => {
    const onTicket = matchPlaybook(ALL, { ...base, ownerApprovalRequired: true });
    expect(onTicket.primary?.playbook.playbook_key).toBe("vendor_dispatch");
    const onClaim = matchPlaybook(ALL, { objectType: "claim", ownerApprovalRequired: true });
    expect(onClaim.primary).toBeNull();
  });

  it("returns at most two secondary references, primary first", () => {
    const r = matchPlaybook(ALL, {
      ...base,
      category: "water",
      priority: "p1",
      guestInHome: true,
      workTypeName: "No heat / no cooling",
      ownerApprovalRequired: true,
    });
    expect(r.primary?.playbook.playbook_key).toBe("water_active_leak");
    expect(r.secondary.length).toBeLessThanOrEqual(2);
    expect(r.secondary.map((s) => s.playbook.playbook_key)).not.toContain("water_active_leak");
  });

  it("reports no approved guidance when the match carries steps only", () => {
    const stepsOnly = pb({
      id: "steps",
      title: "Pest sighting",
      category: "pest",
      playbook_key: "pest",
      matcher: { categories: ["pest"] },
    });
    const r = matchPlaybook([stepsOnly], { ...base, category: "pest" });
    expect(r.primary).not.toBeNull();
    expect(r.hasApprovedGuidance).toBe(false);
    expect(NO_APPROVED_GUIDANCE).toContain("No approved Playbook");
  });
});

describe("authored content rules", () => {
  it("flags authored text that states a threshold the policy engine owns", () => {
    const drifted = pb({
      id: "drift",
      title: "Guest recovery",
      playbook_key: "recovery",
      matcher: { categories: ["guest"] },
      immediate_actions: ["Approve up to $50 yourself."],
    });
    expect(driftWarnings(drifted).length).toBe(1);
    expect(driftWarnings(leak).length).toBe(0);
  });

  it("treats steps-only playbooks as having no authored judgment", () => {
    expect(hasAuthoredGuidance(librarySteps)).toBe(false);
    expect(hasAuthoredGuidance(leak)).toBe(true);
  });

  it("parses vendor brief and drops empty ones", () => {
    expect(vendor.vendor_brief?.scope).toBe("Diagnose and quote");
    expect(vendor.vendor_brief?.must_check).toEqual([]);
    expect(librarySteps.vendor_brief).toBeNull();
  });
});

describe("the right guidance for the right problem", () => {
  const leakWords = pb({
    id: "leak-words",
    title: "Water leak (under sink / fixture)",
    category: "water",
    playbook_key: "water_leak_under_sink",
    matcher: {
      categories: ["maintenance"],
      keywords: ["leak", "leaking", "under sink", "drip", "flood", "burst"],
    },
    immediate_actions: ["Shut the local supply off."],
  });

  const hotWater = pb({
    id: "hot-water",
    title: "No hot water / water heater failure",
    category: "maintenance",
    playbook_key: "no_hot_water",
    matcher: {
      categories: ["maintenance"],
      keywords: ["no hot water", "hot water", "water heater", "cold shower"],
    },
    immediate_actions: ["Confirm gas or electric before dispatching."],
  });

  const library = [leakWords, hotWater];

  it("a no-hot-water report opens the hot water guidance, not the leak guidance", () => {
    const result = matchPlaybook(library, {
      objectType: "ticket",
      category: "maintenance",
      text: "Guest says there is no hot water in the shower this morning",
    });
    expect(result.primary?.playbook.title).toBe("No hot water / water heater failure");
  });

  it("an under-sink leak still opens the leak guidance", () => {
    const result = matchPlaybook(library, {
      objectType: "ticket",
      category: "maintenance",
      text: "Water leaking under the kitchen sink, cabinet is wet",
    });
    expect(result.primary?.playbook.title).toBe("Water leak (under sink / fixture)");
  });

  it("a keyword never fires from inside a longer word", () => {
    const result = matchPlaybook(library, {
      objectType: "ticket",
      category: "maintenance",
      text: "Guest asked about the dripless candles left in the cupboard",
    });
    // The category still makes these Playbooks plausible; the point is that
    // "drip" did not fire from inside "dripless".
    expect(result.primary?.reason ?? "").not.toContain("drip");
  });
});
