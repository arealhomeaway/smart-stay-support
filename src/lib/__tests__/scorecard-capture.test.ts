import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import {
  CAPTURE_COPY,
  DEFAULT_RATING_CHANNELS,
  RATING_CHANNELS,
  archiveReasonProblem,
  canArchiveTicket,
  canRestoreTicket,
  countableRecords,
  financePacketVisible,
  financeWeekEnding,
  isGuestIssueTicket,
  isNotReadyError,
  pairCommitments,
  readRatingChannels,
  scorecardRoles,
} from "../scorecard-capture";

// Noon Central on each day of the week starting Monday Nov 9, 2026.
const day = (d: number) => new Date(Date.UTC(2026, 10, d, 18, 0, 0));

describe("finance packet button", () => {
  it("shows only from Thursday through Sunday, Central time", () => {
    expect([9, 10, 11].map((d) => financePacketVisible(day(d)))).toEqual([false, false, false]);
    expect([12, 13, 14, 15].map((d) => financePacketVisible(day(d)))).toEqual([true, true, true, true]);
  });

  it("defaults to the Friday of the current week", () => {
    for (const d of [9, 12, 13, 15]) expect(financeWeekEnding(day(d))).toBe("2026-11-13");
    expect(financeWeekEnding(day(16))).toBe("2026-11-20");
  });

  it("uses Central time, not UTC, near midnight", () => {
    // 11:30 pm Wednesday Central is already Thursday in UTC.
    expect(financePacketVisible(new Date("2026-11-12T05:30:00Z"))).toBe(false);
  });
});

describe("roles", () => {
  it("only the Operations Supervisor role records coaching; Supervisor or Director leads the rest", () => {
    expect(scorecardRoles({ isAdmin: false, supervisorRole: true, directorRole: false, cooRole: false })).toEqual({
      supervisor: true, director: false, coo: false, leads: true,
    });
    expect(scorecardRoles({ isAdmin: false, supervisorRole: false, directorRole: true, cooRole: false }).supervisor).toBe(false);
    expect(scorecardRoles({ isAdmin: false, supervisorRole: false, directorRole: false, cooRole: false }).leads).toBe(false);
    expect(scorecardRoles({ isAdmin: false, supervisorRole: false, directorRole: false, cooRole: true }).leads).toBe(false);
  });

  it("archive is Admin or a Supervisor; restore is Admin only", () => {
    expect(canArchiveTicket({ isSupervisor: false, supervisorRole: false })).toBe(false);
    expect(canArchiveTicket({ isSupervisor: true, supervisorRole: false })).toBe(true);
    expect(canRestoreTicket({ isAdmin: false })).toBe(false);
    expect(canRestoreTicket({ isAdmin: true })).toBe(true);
  });

  it("archive needs a reason", () => {
    expect(archiveReasonProblem("  ")).not.toBeNull();
    expect(archiveReasonProblem("Duplicate")).toBeNull();
  });
});

describe("guest issue tickets", () => {
  it("guest category, guest work type or a linked guest review", () => {
    expect(isGuestIssueTicket({ category: "guest" })).toBe(true);
    expect(isGuestIssueTicket({ category: "other", work_type_category: "guest" })).toBe(true);
    expect(isGuestIssueTicket({ category: "quality", linked_feedback_id: "x" })).toBe(true);
    expect(isGuestIssueTicket({ category: "plumbing" })).toBe(false);
  });
});

describe("exclusions", () => {
  it("leaves out Notion imports, demo and archived tickets", () => {
    const rows = [
      { id: "a", ticket_id: "t1", about_imported_ticket: false, is_demo: false },
      { id: "b", ticket_id: "t2", about_imported_ticket: true, is_demo: false },
      { id: "c", ticket_id: "t3", about_imported_ticket: false, is_demo: false },
      { id: "d", ticket_id: null, about_imported_ticket: false, is_demo: true },
      { id: "e", ticket_id: null, about_imported_ticket: false, is_demo: false },
    ];
    expect(countableRecords(rows, new Set(["t3"])).map((r) => r.id)).toEqual(["a", "e"]);
  });
});

describe("guest rating channels", () => {
  it("defaults to Airbnb and Vrbo, Google excluded", () => {
    expect(DEFAULT_RATING_CHANNELS).toEqual(["airbnb", "vrbo"]);
    expect(readRatingChannels(null)).toEqual(["airbnb", "vrbo"]);
    expect(readRatingChannels({ channels: [] })).toEqual(["airbnb", "vrbo"]);
    expect(readRatingChannels({ channels: ["vrbo", "made_up"] })).toEqual(["vrbo"]);
  });
});

describe("commitments", () => {
  it("pairs each commitment with its COO approval line", () => {
    const rows = [
      { id: "c1", recorded_at: "2026-11-09T10:00:00Z", recorded_by: "u", note: "Fix", refers_to: null, details: { action: "commitment", due_on: "2026-11-12" } },
      { id: "a1", recorded_at: "2026-11-09T12:00:00Z", recorded_by: "coo", note: null, refers_to: "c1", details: { action: "coo_approval" } },
      { id: "c2", recorded_at: "2026-11-10T10:00:00Z", recorded_by: "u", note: "Clean", refers_to: null, details: { action: "commitment", due_on: "2026-11-13" } },
    ];
    const out = pairCommitments(rows);
    expect(out.map((c) => [c.id, c.approval?.id ?? null])).toEqual([["c2", null], ["c1", "a1"]]);
  });
});

describe("not ready", () => {
  it("treats a missing function or table as not ready", () => {
    expect(isNotReadyError({ code: "PGRST202", message: "x" })).toBe(true);
    expect(isNotReadyError({ message: "Could not find the function public.archive_ticket" })).toBe(true);
    expect(isNotReadyError({ message: "Only the COO can approve a commitment." })).toBe(false);
  });
});

describe("delete is gone from the screens", () => {
  it("no screen deletes a ticket and the ticket page has no Delete button", () => {
    const page = readFileSync("src/routes/_authenticated/tickets.$ticketId.tsx", "utf8");
    expect(page).not.toMatch(/from\("tickets"\)\s*\.delete\(/);
    expect(page).not.toMatch(/Delete ticket/);
    expect(page).toMatch(/ArchiveTicketButton/);
  });

  it("there is no Complete sweep button anywhere", () => {
    for (const f of [
      "src/routes/_authenticated/dashboard.tsx",
      "src/routes/_authenticated/supervisor-check.tsx",
      "src/routes/_authenticated/oversight.tsx",
      "src/routes/_authenticated/team-queue.tsx",
      "src/components/scorecard/SupervisorRecords.tsx",
    ]) {
      expect({ f, hit: /Complete sweep/i.test(readFileSync(f, "utf8")) }).toEqual({ f, hit: false });
    }
  });
});

describe("word check", () => {
  const BANNED = [/\bseats?\b/i, /\bhit\b/i, /\bmedian\b/i, /\bPC\d\b/, /\u2014/, /\$\d/];
  const strings = [...Object.values(CAPTURE_COPY), ...RATING_CHANNELS.map((c) => c.label)];

  it("no screen wording uses a banned word, a tracking code, money or a long dash", () => {
    for (const s of strings) for (const re of BANNED) expect({ s, hit: re.test(s) }).toEqual({ s, hit: false });
  });

  it("the new screen files carry no banned word or long dash", () => {
    const files = [
      "src/components/scorecard/ArrivalReadyCard.tsx",
      "src/components/scorecard/SupervisorRecords.tsx",
      "src/components/scorecard/CorrectiveCommitments.tsx",
      "src/components/scorecard/TicketArchive.tsx",
      "src/components/scorecard/RatingChannelsCard.tsx",
      "src/components/scorecard/ArchivedTicketsPanel.tsx",
      "src/components/routines/RoutineCorrections.tsx",
    ];
    for (const f of files) {
      const text = readFileSync(f, "utf8");
      for (const re of BANNED) expect({ f, re: String(re), hit: re.test(text) }).toEqual({ f, re: String(re), hit: false });
    }
  });
});
