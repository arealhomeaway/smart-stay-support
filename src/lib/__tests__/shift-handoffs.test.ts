import { describe, expect, it } from "bun:test";
import { can } from "@/lib/permissions";
import { canOpenPath } from "@/lib/route-access";
import { centralInstant } from "@/lib/team-schedule";
import { handoffKind, roleLabel, shiftHandoffCounts, shiftHandoffsView, type SHHandoff, type SHInput } from "@/lib/shift-handoffs";

// Monday Nov 16 2026, Central time. weekday 1.
const DAY = "2026-11-16";
const PC_A = "00000000-0000-4000-8000-0000000000a1"; // ge_evening, 1 PM to 10 PM
const PC_B = "00000000-0000-4000-8000-0000000000b1"; // po_day, 8 AM to 5 PM
const SUP = "00000000-0000-4000-8000-0000000000c1";
const at = (min: number) => new Date(centralInstant(DAY, min));

const base = (): SHInput => ({
  roles: [
    { code: "ge_evening", name: "Guest Experience \u2014 Evening", current_seat_holder: PC_A, active: true },
    { code: "po_day", name: "Property Operations \u2014 Weekday Day", current_seat_holder: PC_B, active: true },
    { code: "ops_supervisor", name: "Operations Supervisor", current_seat_holder: SUP, active: true },
  ],
  shifts: [
    { id: "s1", role_code: "ge_evening", weekday: 1, start_minute: 780, end_minute: 1320, active: true },
    { id: "s2", role_code: "po_day", weekday: 1, start_minute: 480, end_minute: 1020, active: true },
  ],
  overrides: [],
  records: [],
  handoffs: [],
  tickets: [
    { id: "t1", status: "open", is_demo: true, current_action_owner: PC_B },
    { id: "t2", status: "in_progress", is_demo: true, assigned_to: PC_B },
    { id: "t3", status: "resolved", is_demo: true, assigned_to: PC_B },
    { id: "t4", status: "open", is_demo: false, assigned_to: PC_B },
  ],
});

const handoff = (over: Partial<SHHandoff>): SHHandoff => ({
  id: "h1", ticket_id: "t1", from_user: PC_B, to_user: PC_A, to_role_code: "ge_evening", handoff_type: "ownership_transfer",
  priority: "p2", actions_completed: "Called the guest", current_status: null, next_action: "Send the plumber", due_at: null,
  status: "pending", responded_at: null, response_reason: null, accepted_at: null, created_at: at(600).toISOString(), is_demo: false,
  ticket: { id: "t1", ref: 101, title: "Leak", priority: "p2", is_demo: true, functional_role_code: "po_day" },
  ...over,
});

describe("Shift handoffs: missed shift ends", () => {
  it("a coordinator whose shift ended without End my shift is missed, with the open tickets they still own", () => {
    const v = shiftHandoffsView(base(), { date: DAY, team: "all", demo: true, now: at(1030) });
    expect(v.missed.map((p) => p.userId)).toEqual([PC_B]);
    expect(v.missed[0]!.openOwned).toBe(2); // t1 and t2; resolved and live tickets do not count
  });

  it("is not missed before the shift ends, or once End my shift was pressed that day", () => {
    expect(shiftHandoffsView(base(), { date: DAY, team: "all", demo: true, now: at(1019) }).missed).toEqual([]);
    const input = base();
    input.records = [{ id: "r1", user_id: PC_B, kind: "end_of_shift", ended_at: at(1010).toISOString(), nothing_to_hand_off: true, handoff_ids: [], is_demo: true }];
    const v = shiftHandoffsView(input, { date: DAY, team: "all", demo: true, now: at(1030) });
    expect(v.missed).toEqual([]);
    const row = v.shifts.find((p) => p.userId === PC_B)!;
    expect([row.state, row.nothing, row.handedOff]).toEqual(["ended", true, 0]);
  });

  it("a lunch handoff does not count as End my shift", () => {
    const input = base();
    input.records = [{ id: "r1", user_id: PC_B, kind: "lunch", ended_at: at(770).toISOString(), nothing_to_hand_off: true, handoff_ids: [], is_demo: true }];
    expect(shiftHandoffsView(input, { date: DAY, team: "all", demo: true, now: at(1030) }).missed.map((p) => p.userId)).toEqual([PC_B]);
  });

  it("a day off moves the shift to the cover, who is then the one expected to end it", () => {
    const COVER = "00000000-0000-4000-8000-0000000000d1";
    const input = base();
    input.overrides = [
      { id: "o1", role_code: "po_day", kind: "cover", user_id: COVER, starts_at: at(480).toISOString(), ends_at: at(1020).toISOString(), note: null, created_at: at(0).toISOString() },
    ];
    const v = shiftHandoffsView(input, { date: DAY, team: "all", demo: true, now: at(1030) });
    expect(v.missed.map((p) => [p.userId, p.covering])).toEqual([[COVER, true]]);
  });

  it("the team filter keeps Team B only", () => {
    const v = shiftHandoffsView(base(), { date: DAY, team: "A", demo: true, now: at(1400) });
    expect(v.shifts.map((p) => p.userId)).toEqual([PC_A]);
  });
});

describe("Shift handoffs: waiting Right now handoffs", () => {
  it("a waiting Right now handoff is late after 15 minutes and shows first", () => {
    const input = base();
    input.handoffs = [
      handoff({ id: "h1", priority: "p1", created_at: at(600).toISOString() }),
      handoff({ id: "h2", priority: "p2", created_at: at(590).toISOString() }),
    ];
    const at14 = shiftHandoffsView(input, { date: DAY, team: "all", demo: true, now: at(614) });
    expect(at14.late).toEqual([]);
    const at16 = shiftHandoffsView(input, { date: DAY, team: "all", demo: true, now: at(616) });
    expect(at16.late.map((r) => r.id)).toEqual(["h1"]);
    expect(at16.handoffs.map((r) => [r.id, r.statusText])).toEqual([["h2", "Waiting 26 min"]]);
  });

  it("accepted and declined handoffs show when and why", () => {
    const input = base();
    input.handoffs = [
      handoff({ id: "h1", status: "accepted", accepted_at: at(620).toISOString() }),
      handoff({ id: "h2", status: "rejected", response_reason: "Not my team" }),
    ];
    const v = shiftHandoffsView(input, { date: DAY, team: "all", demo: true, now: at(700) });
    expect(v.handoffs.map((r) => r.statusText).sort()).toEqual(["Accepted Nov 16, 10:20 AM", "Declined: Not my team"]);
  });

  it("names the way each handoff was made", () => {
    const records = [{ id: "r1", user_id: PC_B, kind: "lunch", ended_at: "", nothing_to_hand_off: false, handoff_ids: ["h9"], is_demo: true }];
    expect(handoffKind({ id: "h9", handoff_type: "shift_coverage", current_status: null }, records)).toBe("lunch");
    expect(handoffKind({ id: "h8", handoff_type: "shift_coverage", current_status: "Handed off at the end of a shift" }, [])).toBe("end_of_shift");
    expect(handoffKind({ id: "h7", handoff_type: "ownership_transfer", current_status: null }, [])).toBe("hand_off");
  });

  it("counts every waiting handoff in the lens plus today's missed shift ends", () => {
    const input = base();
    input.handoffs = [
      handoff({ id: "h1", priority: "p1" }),
      handoff({ id: "h2", status: "accepted" }),
      handoff({ id: "h3", ticket: { id: "t4", ref: 4, title: "Live", priority: "p2", is_demo: false, functional_role_code: null } }),
    ];
    expect(shiftHandoffCounts(input, true, at(1030))).toEqual({ waiting: 1, late: 1, missed: 1, total: 2 });
  });

  it("labels are roles, never codes or long dashes", () => {
    expect(roleLabel("po_day")).toBe("Property operations weekday day coordinator".replace(/^p/, "P"));
    expect(roleLabel("ops_supervisor")).toBe("Operations Supervisor");
    expect(roleLabel("finance_lead", [{ code: "finance_lead", name: "Finance \u2014 Lead", current_seat_holder: null }])).toBe("Finance, Lead");
    expect(roleLabel(null)).toBe("Teammate");
  });
});

describe("Shift handoffs: who can open it", () => {
  it("the Operations Supervisor, the Director of Operations and Admin; nobody else", () => {
    expect(can(["manager"], "shift_handoffs", { opsSupervisor: true })).toBe(true);
    expect(can(["manager"], "shift_handoffs", { opsDirector: true })).toBe(true);
    expect(can(["admin"], "shift_handoffs")).toBe(true);
    expect(can(["manager"], "shift_handoffs")).toBe(false);
    expect(can(["tech"], "shift_handoffs")).toBe(false);
    expect(can(["manager"], "shift_handoffs", { finance: true })).toBe(false);
    expect(can(["onboarding"], "shift_handoffs", { onboardingDirector: true })).toBe(false);
  });
});
