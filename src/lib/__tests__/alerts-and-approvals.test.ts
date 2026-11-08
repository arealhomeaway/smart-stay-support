import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { insertMention, matchPeople, mentionQuery, mentionsInText } from "../mentions";
import { canDecideClaim, claimAuthority, CLAIM_APPROVAL_COPY } from "../claim-approval";
import { DEFAULT_PREFERENCES, NOTIFICATION_CATEGORIES, allowsEmail, allowsInApp, categoryForKind, readPreferences } from "../notification-preferences";
import { notificationLink } from "../notification-feed";
import { vendorDispatchAlerts } from "../deadline-alerts";

/** Alerts and approvals (Emily, Nov 7, 2026; register T2, T6, C2, C3). */
const read = (p: string) => readFileSync(p, "utf8");
const T = "11111111-1111-4111-8111-111111111111";
const W = "22222222-2222-4222-8222-222222222222";
const people = [
  { id: "a", full_name: "Ana Lopez", email: "ana@arha.test" },
  { id: "b", full_name: "Ben Ortiz", email: "ben@arha.test" },
  { id: "c", full_name: "Anabel Cruz", email: "anabel@arha.test" },
];

describe("@mention picker", () => {
  it("typing @ opens the picker; a word joined to other text does not", () => {
    expect(mentionQuery("Call @", 6)).toEqual({ start: 5, query: "" });
    expect(mentionQuery("Call @an", 8)).toEqual({ start: 5, query: "an" });
    expect(mentionQuery("@Ana Lo", 7)).toEqual({ start: 0, query: "Ana Lo" });
    expect(mentionQuery("mail me@arha", 12)).toBeNull();
    expect(mentionQuery("no mention", 10)).toBeNull();
  });
  it("lists staff by name, starts first", () => {
    expect(matchPeople(people, "an").map((p) => p.id)).toEqual(["a", "c"]);
    expect(matchPeople(people, "ortiz").map((p) => p.id)).toEqual(["b"]);
    expect(matchPeople(people, "zz")).toEqual([]);
  });
  it("picking writes @Full Name and only names still in the note are recorded", () => {
    const r = insertMention("Call @an please", 5, 8, people[0]!);
    expect(r.text).toBe("Call @Ana Lopez  please");
    expect(mentionsInText(r.text, ["a", "b", "a"], people)).toEqual(["a"]);
    expect(mentionsInText("Call please", ["a"], people)).toEqual([]);
  });
  it("both note boxes on a ticket use the picker and save the mentions", () => {
    const page = read("src/routes/_authenticated/tickets.$ticketId.tsx");
    expect(page).toContain("<MentionTextarea");
    expect(page).toContain('log("note", note.trim(), "note", mentionsInText(note, notePicked, mentionPeople.data ?? []))');
    const panel = read("src/components/MatterOwnershipPanel.tsx");
    expect(panel).toContain("<MentionTextarea");
    expect(panel).toContain("mentionsInText(note, notePicked");
  });
});

describe("Claim card decision (C2)", () => {
  it("$500 and under a coordinator; $600 the Operations Supervisor; $1,600 the Director of Operations", () => {
    expect(claimAuthority(500)).toBe("coordinator");
    expect(claimAuthority(600)).toBe("supervisor");
    expect(claimAuthority(1500)).toBe("supervisor");
    expect(claimAuthority(1600)).toBe("director");
  });
  it("the database repeats the same limits", () => {
    const sql = read("docs/pending/alerts/04_claim_approval.sql");
    expect(sql).toContain("WHEN _amount IS NULL OR _amount <= 500 THEN 'coordinator'");
    expect(sql).toContain("WHEN _amount <= 1500 THEN 'supervisor'");
  });
  it("who can decide", () => {
    expect(canDecideClaim("supervisor", { isSupervisor: true, isDirector: false })).toBe(true);
    expect(canDecideClaim("director", { isSupervisor: true, isDirector: false })).toBe(false);
    expect(canDecideClaim("director", { isSupervisor: false, isDirector: true })).toBe(true);
    expect(canDecideClaim("supervisor", { isSupervisor: false, isDirector: false })).toBe(false);
  });
  it("plain words, roles only, a required reason", () => {
    expect(CLAIM_APPROVAL_COPY.who.supervisor).toBe("Over $500: the Operations Supervisor approves before it is sent.");
    expect(CLAIM_APPROVAL_COPY.who.director).toBe("Over $1,500: the Director of Operations approves before it is sent.");
    expect(CLAIM_APPROVAL_COPY.reason).toBe("Reason (required)");
    const box = read("src/components/claims/ClaimApprovalBox.tsx");
    expect(box).toContain("decisionReasonMissing(reason)");
    expect(read("src/components/claims/TicketClaimPanel.tsx")).toContain("<ClaimApprovalBox");
  });
});

describe("Notification preferences", () => {
  it("notes and mentions, Team Queue and approvals are categories; everyone starts with both on", () => {
    const keys = NOTIFICATION_CATEGORIES.map((c) => c.key);
    for (const k of ["notes_mentions", "team_queue", "approvals"] as const) {
      expect(keys).toContain(k);
      expect(DEFAULT_PREFERENCES.email[k]).toBe(true);
      expect(DEFAULT_PREFERENCES.inApp[k]).toBe(true);
      expect(readPreferences(null).email[k]).toBe(true);
      expect(readPreferences({ email_enabled: true }).inApp[k]).toBe(true);
    }
  });
  it("each new alert sorts into its category and its switches work", () => {
    expect(categoryForKind("ticket_note")).toBe("notes_mentions");
    expect(categoryForKind("note_mention")).toBe("notes_mentions");
    expect(categoryForKind("team_queue_supervisor")).toBe("team_queue");
    expect(categoryForKind("team_queue_director")).toBe("team_queue");
    expect(categoryForKind("approval_required")).toBe("approvals");
    expect(categoryForKind("approval_decided")).toBe("approvals");
    const off = readPreferences({ email_team_queue: false, inapp_notes_mentions: false });
    expect(allowsEmail(off, "team_queue_supervisor")).toBe(false);
    expect(allowsInApp(off, "note_mention")).toBe(false);
    expect(allowsEmail(off, "ticket_note")).toBe(true);
  });
});

describe("Approval alerts open the exact ticket", () => {
  const row = (link: string | null) => ({
    id: "n", kind: "approval_required", title: "", body: "", link_path: link, priority: "urgent",
    read_at: null, created_at: "2026-11-09T10:00:00Z", entity_type: "guest_recovery", entity_id: W,
  });
  it("in the app, a stored ticket link wins over Oversight", () => {
    expect(notificationLink(row(`/tickets/${T}`))).toBe(`/tickets/${T}`);
    expect(notificationLink(row("/oversight"))).toBe("/oversight");
  });
  it("vendor no acknowledgment opens the work order's ticket", () => {
    const now = new Date("2026-11-09T12:00:00Z");
    const [a] = vendorDispatchAlerts([{ id: W, ticket_id: T, assigned_to: "u", vendor_contacted_at: "2026-11-09T10:00:00Z", acknowledge_minutes: 30 }], now);
    expect(a!.kind).toBe("vendor_no_acknowledgment");
    expect(a!.linkPath).toBe(`/tickets/${T}`);
    const [b] = vendorDispatchAlerts([{ id: W, assigned_to: "u", vendor_contacted_at: "2026-11-09T10:00:00Z", acknowledge_minutes: 30 }], now);
    expect(b!.linkPath).toBe(`/work-orders?open=${W}`);
    expect(read("src/lib/deadline-alerts.server.ts")).toContain('"id, ticket_id, title,');
  });
});

describe("Every message says roles, never a name", () => {
  it("the staged alerts name roles only", () => {
    const sql = ["01_team_queue_and_waiting_alerts", "02_note_alerts", "04_claim_approval"].map((f) => read(`docs/pending/alerts/${f}.sql`)).join("\n");
    for (const name of ["James", "Josh", "Emily", "Kati", "Lindsey", "Ryan"]) {
      const quoted = sql.match(/'[^']*'/g) ?? [];
      expect(quoted.some((q) => q.includes(name))).toBe(false);
    }
    expect(sql).toContain("Operations Supervisor");
    expect(sql).toContain("Director of Operations");
    expect(sql).not.toMatch(/'[^']*\bseat\b[^']*'/i);
  });
});
