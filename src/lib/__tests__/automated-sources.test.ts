import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import {
  AUTOMATED_QUEUE_COPY,
  automatedQueueGroups,
  automatedSourceOf,
  automatedTeam,
  takeTicketPatch,
} from "../automated-sources";
import { unclaimedCount } from "../home-work";
import { followUpSource } from "../guest-feedback.server";
import { HOME_BOOKING_COPY, homeBookingLine, overnightUnclaimedCount } from "../direct-bookings";

/** Fix batch 4 (Emily, Nov 7 and 8, 2026; register T15, D2, D3). */
const read = (p: string) => readFileSync(p, "utf8");
const t = (id: string, extra: Record<string, unknown> = {}) => ({ id, status: "open", reported_at: `2026-11-09T1${id.length}:00:00Z`, ...extra });

describe("which tickets come from an automated source", () => {
  it("the info inbox, OwnerRez and Breezeway; nothing staff record", () => {
    expect(automatedSourceOf({ external_source: "email" })).toBe("email");
    expect(automatedSourceOf({ external_source: "OwnerRez" })).toBe("ownerrez");
    expect(automatedSourceOf({ external_source: "breezeway" })).toBe("breezeway");
    expect(automatedSourceOf({ external_source: "notion" })).toBeNull();
    expect(automatedSourceOf({ external_source: null })).toBeNull();
  });
  it("the database rule checks the same three sources", () => {
    expect(read("docs/pending/fix-batch-4/01_automated_sources_unowned.sql")).toContain("IN ('email', 'ownerrez', 'breezeway')");
  });
  it("each automated path marks its source; Record work never does", () => {
    const intake = read("src/lib/intake.server.ts");
    expect(intake).toContain("external_source: source,");
    expect(intake).toContain('(payload.source ?? "email")');
    expect(read("src/lib/breezeway-routing.server.ts")).toContain('external_source: "breezeway",');
    expect(read("src/routes/_authenticated/tickets.new.tsx")).not.toContain("external_source");
  });
  it("an OwnerRez review follow up is marked as from OwnerRez; a survey follow up is not", () => {
    expect(followUpSource({ id: "f1", source: "ownerrez" } as never)).toEqual({ external_source: "ownerrez", external_id: "review_followup:f1", source_channel: "ownerrez" });
    expect(followUpSource({ id: "f2", source: "resolve_survey" } as never)).toEqual({});
    expect(read("src/lib/guest-feedback.server.ts")).toContain("...followUpSource(fb),");
  });
});

describe("Breezeway stops overwriting the owner", () => {
  const src = read("src/lib/breezeway-routing.server.ts");
  const create = src.slice(src.indexOf("export async function createTicketFromWorkOrder"));
  it("creating a ticket from a Work Order sets no owner and never routes it", () => {
    expect(create).not.toContain("routeBreezewayTicket(");
    expect(create).not.toContain("current_action_owner: decision");
    expect(create).not.toContain(".update(");
    expect(create).toContain("assignedTo: null,");
    expect(create).toContain("note: BREEZEWAY_TICKET_NOTE,");
  });
});

describe("the Team Queue: Waiting to be taken, by team and source", () => {
  const rows = [
    t("a", { external_source: "email" }),
    t("bb", { external_source: "breezeway" }),
    t("ccc", { external_source: "ownerrez", work_types: { functional_role_code: "ge_day" } }),
    t("dddd", { external_source: "breezeway", functional_role_code: "ge_evening" }),
    t("eeeee", { external_source: "email", assigned_to: "u" }),
    t("ffffff", { external_source: "email", status: "closed" }),
    t("ggggggg", { external_source: "ownerrez", archived_at: "2026-11-09T00:00:00Z" }),
    t("hhhhhhhh", {}),
  ];
  it("the team comes from the work type; Breezeway with no work type is Team B; inbox with none has no team yet", () => {
    expect(automatedTeam(rows[0] as never)).toBeNull();
    expect(automatedTeam(rows[1] as never)).toBe("property_operations");
    expect(automatedTeam(rows[2] as never)).toBe("guest_experience");
    expect(automatedTeam(rows[3] as never)).toBe("guest_experience");
  });
  it("only open, unowned, not archived automated tickets, grouped Team A, Team B, No team yet", () => {
    const g = automatedQueueGroups(rows as never);
    expect(g.map((x) => [x.label, x.sources.map((s) => [s.label, s.rows.map((r) => r.id)])])).toEqual([
      ["Team A", [["From OwnerRez", ["ccc"]], ["From Breezeway", ["dddd"]]]],
      ["Team B", [["From Breezeway", ["bb"]]]],
      ["No team yet", [["From email", ["a"]]]],
    ]);
  });
  it("Take it writes the same fields as Take this ticket, and only while nobody owns it", () => {
    expect(AUTOMATED_QUEUE_COPY.take).toBe("Take it");
    expect(takeTicketPatch({}, "me")).toEqual({ assigned_to: "me", current_action_owner: "me", record_owner: "me", accountable_owner: "me", assignment_source: "manual", assignment_note: null });
    expect(takeTicketPatch({ record_owner: "x", accountable_owner: "y" }, "me")).toMatchObject({ record_owner: "x", accountable_owner: "y" });
    const panel = read("src/components/MatterOwnershipPanel.tsx");
    for (const f of ["assigned_to: targetId", "current_action_owner: targetId", "record_owner: ticket.record_owner ?? targetId", "accountable_owner: ticket.accountable_owner ?? targetId", 'assignment_source: "manual"', "assignment_note: null"])
      expect(panel).toContain(f);
    const queue = read("src/components/operations/AutomatedSourceQueue.tsx");
    expect(queue).toContain('.is("assigned_to", null)');
    expect(queue).toContain('.is("current_action_owner", null)');
  });
  it("the Team Queue shows the group", () => {
    expect(read("src/routes/_authenticated/team-queue.tsx")).toContain("<AutomatedSourceQueue");
  });
});

describe("Home's Team Queue link number", () => {
  const base = { priority: "p3", status: "open", assigned_to: null, current_action_owner: null, record_owner: null, accountable_owner: null };
  it("a Breezeway ticket with no role counts for Team B, not Team A; inbox tickets count for both", () => {
    const rows = [{ ...base, id: "1", external_source: "breezeway" }, { ...base, id: "2", external_source: "email" }];
    expect(unclaimedCount(rows as never, "property_operations")).toBe(2);
    expect(unclaimedCount(rows as never, "guest_experience")).toBe(1);
    expect(unclaimedCount(rows as never, null)).toBe(2);
  });
  it("an overnight Direct Booking counts for Team A and people with no team", () => {
    const o = [{ id: "x", partner_name: null, company: null, subject: null, created_at: "2026-11-09T05:00:00Z", overnight_until: "2026-11-09T14:00:00Z", owned_by: null, reply_sent_at: null, outcome: null }];
    expect(overnightUnclaimedCount(o, "guest_experience")).toBe(1);
    expect(overnightUnclaimedCount(o, null)).toBe(1);
    expect(overnightUnclaimedCount(o, "property_operations")).toBe(0);
    expect(overnightUnclaimedCount([{ ...o[0]!, owned_by: "u" }], null)).toBe(0);
    const dash = read("src/routes/_authenticated/dashboard.tsx");
    expect(dash).toContain("overnightUnclaimedCount(overnight.data ?? [], myTeam)");
  });
});

describe("Home line for an overnight request (register D3)", () => {
  const night = { created_at: "2026-11-09T05:00:00Z", overnight_until: "2026-11-09T14:00:00Z", reply_sent_at: null, overnight_clock_start: "09:00" };
  it("before 9:00 AM: Reply clock starts at 9:00 AM, waiting or started", () => {
    expect(homeBookingLine({ ...night, waitingForStart: true, followUp: false }, new Date("2026-11-09T14:00:00Z"))).toBe("New request. Press Start to own it. Reply clock starts at 9:00 AM.");
    expect(homeBookingLine({ ...night, waitingForStart: false, followUp: false }, new Date("2026-11-09T14:30:00Z"))).toBe("Direct booking you started. Reply clock starts at 9:00 AM.");
  });
  it("from 9:00 AM, and for daytime requests: the normal lines", () => {
    expect(homeBookingLine({ ...night, waitingForStart: true, followUp: false }, new Date("2026-11-09T15:00:00Z"))).toBe(HOME_BOOKING_COPY.waitingForStart);
    expect(homeBookingLine({ created_at: "2026-11-11T20:00:00Z", overnight_until: null, reply_sent_at: null, waitingForStart: false, followUp: false }, new Date("2026-11-11T20:00:00Z"))).toBe(HOME_BOOKING_COPY.started);
  });
  it("follows the saved setting", () => {
    expect(homeBookingLine({ ...night, overnight_clock_start: "09:30", waitingForStart: true, followUp: false }, new Date("2026-11-09T15:10:00Z"))).toBe("New request. Press Start to own it. Reply clock starts at 9:30 AM.");
  });
});

describe("Direct Bookings settings: Overnight reply clock starts at", () => {
  it("is on the settings page and saved through the existing guarded save", () => {
    const page = read("src/routes/_authenticated/direct-bookings.settings.tsx");
    expect(page).toContain("Overnight reply clock starts at");
    expect(page).toContain("overnightClockStart: clockStart");
    const fns = read("src/lib/direct-bookings.functions.ts");
    expect(fns).toContain('overnightClockStart: z.string().regex(/^([01]\\d|2[0-3]):[0-5]\\d$/, "Choose a time.").optional(),');
    expect(fns).toContain('rpc("save_direct_booking_settings"');
  });
});
