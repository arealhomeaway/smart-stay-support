/**
 * Home: My shift, End my shift, the lunch question, Request time off and the
 * 15 minute handoff alert (Emily, Nov 7, confirmed Nov 9; register T1, T4, T6, S1, S4).
 * Fixed clocks only.
 */
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import {
  MY_SHIFT_COPY,
  RECEIVER_ROLES,
  TIME_OFF_START_DEFAULT,
  defaultReceiver,
  draftProblem,
  handoffAt,
  itemFor,
  lunchLabel,
  lunchPrompt,
  myShiftToday,
  shiftLine,
  ticketsToHandOff,
  timeLabel,
  timeOffOpen,
  timeOffStatusLine,
  urgentBeforeLunch,
  type HandoffTicket,
  type ShiftOverride,
  type ShiftRole,
  type ShiftRow,
} from "@/lib/my-shift";
import { centralInstant } from "@/lib/team-schedule";

// Monday Nov 9 2026, Central.
const at = (hhmm: string, date = "2026-11-09") => {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(centralInstant(date, h! * 60 + m!));
};

const A = "user-a"; // Property Operations weekday day coordinator
const B = "user-b"; // Guest Experience evening coordinator
const C = "user-c"; // Guest Experience day and weekend coordinator (Thu to Mon)
const ROLES: ShiftRole[] = [
  { code: "po_day", current_seat_holder: A },
  { code: "ge_evening", current_seat_holder: B },
  { code: "ge_day", current_seat_holder: C },
  { code: "ops_supervisor", current_seat_holder: "sup" },
];
const SHIFTS: ShiftRow[] = [
  ...[1, 2, 3, 4, 5].map((weekday) => ({ role_code: "po_day", weekday, start_minute: 480, end_minute: 1020, lunch_start_minute: 780, lunch_end_minute: 840 })),
  ...[0, 1, 2, 3, 6].map((weekday) => ({ role_code: "ge_evening", weekday, start_minute: 780, end_minute: 1320, lunch_start_minute: 960, lunch_end_minute: 1020 })),
  ...[0, 1, 4, 5, 6].map((weekday) => ({ role_code: "ge_day", weekday, start_minute: 480, end_minute: 1020, lunch_start_minute: 780, lunch_end_minute: 840 })),
];
const today = (userId: string, now: Date, overrides: ShiftOverride[] = [], isCoordinator = true) =>
  myShiftToday({ userId, isCoordinator, roles: ROLES, shifts: SHIFTS, overrides, now });

describe("My shift card (register T4)", () => {
  it("a person with a shift today sees today's hours and lunch from the schedule", () => {
    expect(shiftLine(today(B, at("10:00")))).toBe("Today: 1 PM to 10 PM, lunch 4 to 5");
    expect(shiftLine(today(A, at("10:00")))).toBe("Today: 8 AM to 5 PM, lunch 1 to 2");
  });

  it("a person with no shift today sees No shift today", () => {
    // Tuesday: the Guest Experience day and weekend coordinator works Thursday to Monday.
    const s = today(C, at("10:00", "2026-11-10"));
    expect(s.worksShifts).toBe(true);
    expect(shiftLine(s)).toBe("No shift today");
    expect(MY_SHIFT_COPY.noShift).toBe("No shift today");
  });

  it("the card shows who is on call tonight", () => {
    expect(MY_SHIFT_COPY.onCall("A teammate")).toBe("On call tonight: A teammate");
    expect(MY_SHIFT_COPY.onCall(null)).toBe("On call tonight: nobody is set");
  });

  it("time off today replaces the hours; covering someone shows their hours", () => {
    const off: ShiftOverride = { role_code: "po_day", kind: "off", user_id: null, starts_at: at("00:00").toISOString(), ends_at: at("23:59").toISOString() };
    expect(shiftLine(today(A, at("10:00"), [off]))).toBe("Time off today");
    const cover: ShiftOverride = { role_code: "po_day", kind: "cover", user_id: C, starts_at: at("00:00").toISOString(), ends_at: at("23:59").toISOString(), created_at: "2026-11-09T12:00:00Z" };
    // C is off Tuesday but covers the weekday day role.
    const tue = (h: string) => at(h, "2026-11-10");
    const coverTue = { ...cover, starts_at: tue("00:00").toISOString(), ends_at: tue("23:59").toISOString() };
    expect(shiftLine(today(C, tue("10:00"), [coverTue]))).toBe("Today: 8 AM to 5 PM, lunch 1 to 2 (covering)");
  });

  it("people who do not work shifts get no card", () => {
    expect(today("someone-else", at("10:00"), [], false).worksShifts).toBe(false);
    // A coordinator without a role yet still gets the card, with No shift today.
    expect(today("new-coordinator", at("10:00"), [], true).worksShifts).toBe(true);
  });

  it("time labels read 1 PM, 1:30 PM and 12 AM; lunch reads 4 to 5", () => {
    expect(timeLabel(780)).toBe("1 PM");
    expect(timeLabel(810)).toBe("1:30 PM");
    expect(timeLabel(0)).toBe("12 AM");
    expect(lunchLabel(960, 1020)).toBe("4 to 5");
  });
});

const T = (o: Partial<HandoffTicket> & { id: string }): HandoffTicket => ({
  priority: "p3",
  status: "open",
  current_action_owner: A,
  external_source: null,
  external_status: null,
  reported_at: null,
  ...o,
});

describe("End my shift (register T6)", () => {
  const now = at("16:30").getTime();
  const rows = [
    T({ id: "routine", priority: "p3" }),
    T({ id: "today-later", priority: "p2", response_due_at: at("21:00").toISOString() }),
    T({ id: "right-now", priority: "p1" }),
    T({ id: "today-soon", priority: "p2", response_due_at: at("17:30").toISOString() }),
    T({ id: "not-mine", current_action_owner: B }),
    T({ id: "already-pending", handoff_status: "pending" }),
    T({ id: "closed", status: "closed" }),
    T({ id: "quiet-import", external_source: "notion", reported_at: at("09:00").toISOString() }),
  ];

  it("walks each open ticket the person owns, Right now and time sensitive Today first", () => {
    const list = ticketsToHandOff(rows, A, at("19:00").getTime(), now).map((t) => t.id);
    expect(list).toEqual(["right-now", "today-soon", "today-later", "routine"]);
  });

  it("a person with nothing open has Nothing to hand off", () => {
    expect(ticketsToHandOff(rows, "nobody", at("19:00").getTime(), now)).toEqual([]);
    expect(MY_SHIFT_COPY.nothingOpen).toBe("You have no open tickets. Nothing to hand off.");
    expect(MY_SHIFT_COPY.nothing).toBe("Nothing to hand off");
  });

  it("each ticket needs who gets it, done so far, the next step and when it is due", () => {
    const d = { ticketId: "x", receiver: "", done: "", nextStep: "", dueAt: "" };
    expect(draftProblem(d)).toBe("Choose who gets it.");
    expect(draftProblem({ ...d, receiver: "user:b" })).toBe("Write what is done so far.");
    expect(draftProblem({ ...d, receiver: "user:b", done: "Called" })).toBe("Write the next step.");
    expect(draftProblem({ ...d, receiver: "user:b", done: "Called", nextStep: "Call back" })).toBe("Choose when it is due.");
    expect(draftProblem({ ...d, receiver: "user:b", done: "Called", nextStep: "Call back", dueAt: "2026-11-09T18:00" })).toBeNull();
  });

  it("a person or a role is sent; a role resolves to the person on shift in the database", () => {
    expect(itemFor({ ticketId: "t", receiver: "user:b", done: " x ", nextStep: " y ", dueAt: "2026-11-09T18:00:00Z" })).toEqual({
      ticket_id: "t", to_user: "b", to_role: null, done: "x", next_step: "y", due_at: "2026-11-09T18:00:00.000Z",
    });
    expect(itemFor({ ticketId: "t", receiver: "role:coordinator", done: "x", nextStep: "y", dueAt: "2026-11-09T18:00:00Z" }).to_role).toBe("coordinator");
    expect(RECEIVER_ROLES[0]).toEqual({ value: "role:coordinator", label: "Property Coordinator on shift" });
    expect(RECEIVER_ROLES.at(-1)).toEqual({ value: "role:ops_supervisor", label: "Operations Supervisor" });
  });

  it("the default is the next person on shift on the ticket's team, from routing", () => {
    const defaults = [
      { team: "guest_experience", user_id: B, role_code: "ge_evening", note: "" },
      { team: "property_operations", user_id: "po-evening", role_code: "po_evening", note: "" },
      { team: "supervisor", user_id: "sup", role_code: "ops_supervisor", note: null },
    ];
    expect(defaultReceiver({ functional_role_code: "po_day" }, defaults, "guest_experience")?.user_id).toBe("po-evening");
    expect(defaultReceiver({ functional_role_code: "ge_day" }, defaults, null)?.user_id).toBe(B);
    expect(defaultReceiver({ functional_role_code: null }, defaults, "guest_experience")?.user_id).toBe(B);
    expect(defaultReceiver({ functional_role_code: null }, defaults, null)?.user_id).toBe("sup");
  });

  it("handoffs are planned for the end of the shift while it is still ahead", () => {
    const s = today(A, at("16:30"));
    expect(handoffAt("end_of_shift", s, at("16:30"))).toBe(at("17:00").toISOString());
    expect(handoffAt("end_of_shift", s, at("17:30"))).toBe(at("17:30").toISOString());
    expect(handoffAt("lunch", s, at("12:50"))).toBe(at("13:00").toISOString());
  });

  it("the words say ownership moves only on Accept", () => {
    expect(MY_SHIFT_COPY.walkHint).toBe("Hand each open ticket to the next person on shift. You still own each one until it is accepted.");
    expect(MY_SHIFT_COPY.confirm(2)).toBe("Hand off 2 tickets and end my shift");
    expect(MY_SHIFT_COPY.ended(2)).toBe("Your shift is ended. 2 handoffs wait for Accept. You still own each until it is accepted.");
  });
});

describe("Lunch (register S1)", () => {
  const s = today(A, at("12:50"));
  it("asks from 15 minutes before lunch until it ends, and never at other times", () => {
    expect(lunchPrompt(s, at("12:44"))).toBeNull();
    expect(lunchPrompt(s, at("12:45"))).toEqual({ lunchStart: 780, lunchEnd: 840 });
    expect(lunchPrompt(s, at("13:59"))).not.toBeNull();
    expect(lunchPrompt(s, at("14:00"))).toBeNull();
    expect(MY_SHIFT_COPY.lunchAsk(780)).toBe("Your lunch starts at 1 PM. Any Right now or time sensitive work? Hand it off first.");
  });

  it("asks only about Right now and Today work due before lunch ends", () => {
    const rows = [
      T({ id: "p1", priority: "p1" }),
      T({ id: "p2-soon", priority: "p2", response_due_at: at("13:30").toISOString() }),
      T({ id: "p2-later", priority: "p2", response_due_at: at("16:00").toISOString() }),
      T({ id: "p2-waiting", priority: "p2", status: "waiting", response_due_at: at("13:30").toISOString() }),
      T({ id: "p3", priority: "p3" }),
    ];
    expect(urgentBeforeLunch(rows, A, at("14:00").getTime(), at("12:50").getTime()).map((t) => t.id)).toEqual(["p1", "p2-soon"]);
  });

  it("never blocks the break: the prompt has a skip button", () => {
    const src = readFileSync("src/components/home/MyShift.tsx", "utf8");
    expect(src).toContain("MY_SHIFT_COPY.lunchSkip");
    expect(MY_SHIFT_COPY.lunchSkip).toBe("Nothing to hand off");
  });
});

describe("Request time off (register S4)", () => {
  it("is off before Nov 16 and on from Nov 16 by default", () => {
    expect(TIME_OFF_START_DEFAULT).toBe("2026-11-16");
    expect(timeOffOpen(null, at("23:59", "2026-11-15"))).toBe(false);
    expect(timeOffOpen(null, at("00:01", "2026-11-16"))).toBe(true);
    expect(timeOffOpen("2026-11-20", at("10:00", "2026-11-18"))).toBe(false);
    expect(MY_SHIFT_COPY.timeOffNotYet("2026-11-16")).toBe("Time off requests start Nov 16");
  });

  it("the person sees the status on My shift", () => {
    expect(timeOffStatusLine({ starts_on: "2026-11-20", ends_on: "2026-11-22", status: "pending", decision_note: null })).toBe("Nov 20 to Nov 22: waiting for the Operations Supervisor");
    expect(timeOffStatusLine({ starts_on: "2026-11-20", ends_on: "2026-11-20", status: "approved", decision_note: null })).toBe("Nov 20: approved");
    expect(timeOffStatusLine({ starts_on: "2026-11-20", ends_on: "2026-11-20", status: "declined", decision_note: "Short staffed" })).toBe("Nov 20: declined. Short staffed");
  });

  it("goes to the Operations Supervisor, who approves with the existing time off and cover form", () => {
    const src = readFileSync("src/components/home/MyShift.tsx", "utf8");
    expect(src).toContain('supabase.rpc("seat_holder_at", { _role_code: "ops_supervisor" })');
    expect(src).toContain("<TimeOffDialog");
    expect(src).toContain('decide(approving, "approved", "")');
  });
});

describe("Home order (register T1)", () => {
  it("My shift sits after Routine work due today and before Recent activity", () => {
    const src = readFileSync("src/routes/_authenticated/dashboard.tsx", "utf8");
    const routine = src.indexOf("<RoutineWorkDue");
    const shift = src.indexOf("<MyShiftCard");
    const recent = src.indexOf("<RecentActivity rows");
    expect(routine).toBeGreaterThan(0);
    expect(shift).toBeGreaterThan(routine);
    expect(recent).toBeGreaterThan(shift);
    expect(src.indexOf("<TimeOffRequestsWaiting")).toBeGreaterThan(src.indexOf("function NeedsYouNow"));
  });
});

describe("the database step (docs/pending/home-my-shift)", () => {
  const staged = readFileSync("docs/pending/home-my-shift/01_home_my_shift.sql", "utf8");
  const applied = readFileSync("drizzle/migrations/0316_home_my_shift.sql", "utf8");
  const live = readFileSync("docs/pending/home-my-shift/live-capture/public.run_ticket_timed_alerts.sql", "utf8");

  it("was applied byte for byte", () => {
    expect(applied.trimEnd()).toBe(staged.trimEnd());
  });

  it("keeps parts a and b of the every minute check exactly as live", () => {
    const part = (s: string, from: string, to: string) => s.slice(s.indexOf(from), s.indexOf(to));
    const newFn = staged.slice(staged.indexOf("CREATE OR REPLACE FUNCTION public.run_ticket_timed_alerts()"));
    expect(part(newFn, "  -- a. Right now", "  -- c. Right now")).toBe(part(live, "  -- a. Right now", "  RETURN _sent;"));
  });

  it("alerts an unaccepted Right now handoff once each to the receiver and the Supervisor after 15 minutes", () => {
    expect(staged).toContain("_handoff_min int := 15;");
    expect(staged).toContain("AND h.priority = 'p1'");
    expect(staged).toContain("VALUES (_t.ticket_id, 'handoff_receiver', _t.created_at, _t.to_user)");
    expect(staged).toContain("VALUES (_t.ticket_id, 'handoff_supervisor', _t.created_at, _to)");
    expect(staged.match(/ON CONFLICT ON CONSTRAINT ticket_timed_alerts_once DO NOTHING/g)?.length).toBe(5);
    // In app and email.
    expect(staged).toMatch(/'handoff_unaccepted',[\s\S]*?'urgent', NULL, true, _t\.is_demo\)/);
  });

  it("a role with nobody on shift goes to the Supervisor; ownership is not moved", () => {
    expect(staged).toContain("v_to := public.seat_holder_at('ops_supervisor', v_at); v_to_role := 'ops_supervisor';");
    const update = staged.slice(staged.indexOf("UPDATE public.tickets\n       SET handoff_status = 'pending'"), staged.indexOf("INSERT INTO public.ticket_activity"));
    expect(update).not.toMatch(/current_action_owner|assigned_to|record_owner|accountable_owner/);
  });

  it("does not change routing, the handoff alerts or the schedule", () => {
    for (const fn of ["coordinator_for", "coordinators_on_shift", "ticket_route_at", "auto_assign_ticket", "notify_handoff_events", "seat_holder_at", "oncall_user_for_night"]) {
      expect(staged).not.toContain(`FUNCTION public.${fn}(`);
    }
    expect(staged).not.toMatch(/ALTER TABLE public\.(coverage_shifts|coverage_overrides|oncall_roster|functional_roles|handoffs|tickets)\b/);
    expect(staged).not.toMatch(/cron\./);
  });

  it("the existing ticket handoff panel is unchanged and does not call the new step", () => {
    const panel = readFileSync("src/components/HandoffPanel.tsx", "utf8");
    expect(panel).not.toContain("end_my_shift");
    expect(panel).toContain('.update({ handoff_status: "rejected", pending_handoff_to: null })');
  });
});

describe("wording", () => {
  it("no seat, no long dash, no names, roles only", () => {
    const words = Object.values(MY_SHIFT_COPY).map((v) => (typeof v === "function" ? (v as (x: never) => string)(2 as never) : v));
    for (const w of [...words, ...RECEIVER_ROLES.map((r) => r.label)]) {
      expect(w).not.toMatch(/\bseat\b/i);
      expect(w).not.toContain("—");
      expect(w).not.toMatch(/\b(Emily|James|Romeo|Mike|Avy|Christine)\b/);
    }
  });
});
