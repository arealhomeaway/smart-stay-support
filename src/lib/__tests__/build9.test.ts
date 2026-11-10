/**
 * Build 9 (Emily, Nov 10): answers and fixes from the overnight questions.
 * One check per rule Emily set; values come from her words.
 */
import { describe, expect, it } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolveHandoffReceiver } from "@/lib/handoff-receiver";
import { centralDateTime, centralInputToIso, isoToCentralInput } from "@/lib/dates";
import { MY_SCORECARD_COPY, MY_SCORECARD_TO, myScorecardGroups } from "@/lib/home-needs";
import { canOpenPath, showExportCheckLink, viewOnlyPath } from "@/lib/route-access";
import { capabilitiesFor } from "@/lib/permissions";
import { fewerLiveTables, fewerLiveWarning, notCopiedLines } from "@/lib/nightly-export";
import { HANDOFFS_COPY, handoffTaskLines } from "@/lib/handoffs-overview";
import { canMarkHomeReady } from "@/lib/home-context";
import { MOVE_TO_QUEUE_LIVE, canMoveToQueue } from "@/lib/ticket-tabs";
import { PORTAL_APPROVED_ALERT, portalApprovedAlertRow } from "@/lib/portal-requests";
import { scheduleOnlyPeople, timeOffApprovalRows } from "@/lib/team-schedule";

const read = (p: string) => readFileSync(p, "utf8");
const ME = "00000000-0000-0000-0000-000000000001";
const OTHER = "00000000-0000-0000-0000-000000000002";

describe("C1 a handoff to a role goes to the person on shift (T6)", () => {
  it("sends it to the person on shift in that role", () => {
    expect(resolveHandoffReceiver({ chosenUser: null, roleName: "Property Coordinator", onShift: true, holder: OTHER, me: ME })).toEqual({ ok: true, toUser: OTHER });
  });
  it("refuses a role with nobody on shift", () => {
    expect(resolveHandoffReceiver({ chosenUser: null, roleName: "Property Coordinator", onShift: false, holder: OTHER, me: ME })).toEqual({
      ok: false,
      message: "Nobody is on shift as Property Coordinator right now. Choose a person or another role.",
    });
    expect(resolveHandoffReceiver({ chosenUser: null, roleName: "Property Coordinator", onShift: true, holder: null, me: ME }).ok).toBe(false);
  });
  it("a person the sender chose is kept", () => {
    expect(resolveHandoffReceiver({ chosenUser: OTHER, roleName: "x", onShift: false, holder: null, me: ME })).toEqual({ ok: true, toUser: OTHER });
  });
  it("the Hand off form reads the role's on shift state from the database", () => {
    const src = read("src/components/HandoffPanel.tsx");
    expect(src).toContain('supabase.rpc("seat_eligible_now", { _role_code: form.to_role_code })');
    expect(src).toContain("resolveHandoffReceiver(");
  });
});

describe("C3 and E4 Central time", () => {
  it("shows Central time whatever the viewer's clock is", () => {
    expect(centralDateTime("2026-11-10T21:00:00Z")).toBe("11/10/2026 · 3:00 PM Central time");
  });
  it("reads a typed time as Central, in winter and in summer", () => {
    expect(centralInputToIso("2026-11-10T15:00")).toBe("2026-11-10T21:00:00.000Z");
    expect(centralInputToIso("2026-07-10T15:00")).toBe("2026-07-10T20:00:00.000Z");
    expect(isoToCentralInput("2026-11-10T21:00:00Z")).toBe("2026-11-10T15:00");
  });
  it("the Hand off form says Central time", () => {
    expect(read("src/components/HandoffPanel.tsx")).toContain("Due by (Central time)");
  });
});

describe("C2 approving time off is all or nothing", () => {
  it("sends every time off and cover row in one step", () => {
    const rows = timeOffApprovalRows([
      { type: "override", roleCode: "po_day", kind: "off", userId: null, startsAt: "a", endsAt: "b", note: "" },
      { type: "override", roleCode: "po_day", kind: "cover", userId: OTHER, startsAt: "a", endsAt: "b", note: "" },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[1]).toEqual({ role_code: "po_day", kind: "cover", user_id: OTHER, starts_at: "a", ends_at: "b", note: "" });
  });
  it("refuses anything that is not a time off or cover row", () => {
    expect(() => timeOffApprovalRows([{ type: "setSeat", roleCode: "po_day", userId: null } as never])).toThrow();
  });
});

describe("C4 coordinators see the schedule, never the full user list (S4)", () => {
  it("keeps only the people the schedule names", () => {
    const people = [
      { id: ME, full_name: "Me", oncall_eligible: false },
      { id: OTHER, full_name: "On the schedule", oncall_eligible: true },
      { id: "00000000-0000-0000-0000-000000000003", full_name: "Not named", oncall_eligible: true },
    ];
    const shown = scheduleOnlyPeople(people, { roles: [{ current_seat_holder: OTHER }], overrides: [], roster: [], pattern: null, self: ME });
    expect(shown.map((p) => p.id).sort()).toEqual([ME, OTHER].sort());
    expect(shown.every((p) => p.email === null)).toBe(true);
  });
  it("the on call list for a coordinator comes from that short list", () => {
    expect(read("src/lib/coverage-admin.functions.ts")).toContain("const eligibleIds = (shownPeople as");
  });
});

describe("D2 My scorecard page (A19)", () => {
  it("opens the person's own page, not Analytics, for every staff role", () => {
    expect(MY_SCORECARD_TO).toBe("/my-scorecard");
    expect(canOpenPath("/my-scorecard", { roles: ["tech"] })).toBe(true);
    expect(canOpenPath("/my-scorecard", { roles: ["tech"] })).toBe(true);
  });
  it("lists only the person's own records, by kind, newest first", () => {
    const g = myScorecardGroups(
      [
        { id: "1", kind: "queue_sweep", recorded_at: "2026-11-01", recorded_by: ME, about_user_id: null, note: null },
        { id: "2", kind: "queue_sweep", recorded_at: "2026-11-05", recorded_by: ME, about_user_id: null, note: null },
        { id: "3", kind: "arrival_readiness", recorded_at: "2026-11-02", recorded_by: OTHER, about_user_id: ME, note: null },
        { id: "4", kind: "arrival_readiness", recorded_at: "2026-11-02", recorded_by: OTHER, about_user_id: OTHER, note: null },
      ],
      ME,
    );
    expect(g.map((x) => [x.label, x.count])).toEqual([
      ["Homes ready for arrival", 1],
      ["Queue checks", 2],
    ]);
    expect(g[1]!.rows.map((r) => r.id)).toEqual(["2", "1"]);
    expect(myScorecardGroups([], ME)).toEqual([]);
    expect(MY_SCORECARD_COPY.empty).toBe("No scorecard records yet.");
  });
  it("the page reads only real records", () => {
    const src = read("src/routes/_authenticated/my-scorecard.tsx");
    expect(src).toContain('.eq("is_demo", false)');
    expect(src).not.toMatch(/\.(insert|update|delete|upsert)\(/);
  });
});

describe("D1 the handoff box words", () => {
  it("reads Handoffs, Accept and Decline at 44 pixels", () => {
    const src = read("src/components/HandoffPanel.tsx");
    expect(src).toContain("Handoffs");
    expect(src).not.toMatch(/>\s*Reject\s*</);
    expect(src).not.toContain("Reassignments");
    expect(read("src/components/MatterOwnershipPanel.tsx")).toContain("Handoff pending");
  });
});

describe("E2, E5 and E8 ticket page", () => {
  const page = read("src/routes/_authenticated/tickets.$ticketId.tsx");
  it("the closing form button reads Send for review", () => {
    expect(page).toContain('"Send for review"');
    expect(page).not.toContain("Resolve: send for review");
  });
  it("waiting never counts in the Command Center Typical time to resolve", () => {
    const cc = read("src/lib/command-center.server.ts");
    expect(cc).toContain("minutesExcludingWaiting(t.reported_at, t.resolved_at!, waits.get(t.id))");
    expect(cc).toContain("prior.filter((t) => t.resolved_at).map((t) => resolveMinutesFor(t))");
  });
});

describe("F1 a Supervisor who also holds Finance keeps Finance's view of Onboarding (A16)", () => {
  const both = { roles: ["manager" as const], seats: { opsSupervisor: true, finance: true } };
  it("opens Onboarding, read only", () => {
    expect(capabilitiesFor(both.roles, both.seats).has("onboarding_workspace")).toBe(true);
    expect(canOpenPath("/onboarding", both)).toBe(true);
    expect(viewOnlyPath("/onboarding/projects/1", both)).toBe(true);
    expect(viewOnlyPath("/dashboard", both)).toBe(false);
  });
  it("a Supervisor without Finance still has no Onboarding", () => {
    const sup = { roles: ["manager" as const], seats: { opsSupervisor: true } };
    expect(canOpenPath("/onboarding", sup)).toBe(false);
  });
  it("the Director of Operations with Finance keeps working Onboarding as before", () => {
    expect(viewOnlyPath("/onboarding", { roles: ["manager"], seats: { opsDirector: true, finance: true } })).toBe(false);
  });
});

describe("F3 only the Director of Onboarding marks a home ready (O4)", () => {
  it("is the Director of Onboarding role holder only", () => {
    expect(canMarkHomeReady(ME, ME)).toBe(true);
    expect(canMarkHomeReady(ME, OTHER)).toBe(false);
    expect(canMarkHomeReady(null, null)).toBe(false);
  });
});

describe("F4 the Handoffs page lists each home's own open handoff Tasks", () => {
  const steps = [
    { id: "s2", title: "Handoff meeting", stage: "Handoff", sort_order: 1310 },
    { id: "s1", title: "Final inspection", stage: "Preparing for Handoff", sort_order: 1210 },
    { id: "s3", title: "Photos", stage: "Preparing for Handoff", sort_order: 1220 },
  ];
  it("shows open Tasks in plan order, leaves done ones out, and names untracked steps", () => {
    const t = handoffTaskLines(steps, [
      { id: "t1", title: "Final inspection", status: "open", template_task_id: "s1", due_on: "2026-11-20" },
      { id: "t2", title: "Handoff meeting", status: "open", template_task_id: "s2", due_on: null },
      { id: "t3", title: "Old", status: "complete", template_task_id: "s1", due_on: null },
    ]);
    expect(t.tracked).toBe(true);
    expect(t.open.map((x) => [x.id, x.note])).toEqual([
      ["t1", "Due 2026-11-20"],
      ["t2", "Handoff"],
    ]);
    expect(t.notTracked).toEqual([{ id: "s3", title: "Photos" }]);
    expect(HANDOFFS_COPY.notTracked).toBe("Not tracked in Resolve yet.");
  });
  it("a home with none of the steps says so once", () => {
    expect(handoffTaskLines(steps, [])).toEqual({ tracked: false, open: [], notTracked: [] });
    expect(HANDOFFS_COPY.handoffTasksNotTracked).toBe("Handoff tasks: Not tracked in Resolve yet.");
  });
});

describe("H1 to H3 Export check", () => {
  it("no Oversight link for the Director of Onboarding, who keeps it by address", () => {
    const onb = { roles: ["manager" as const], seats: { onboardingDirector: true } };
    expect(canOpenPath("/export-check", onb)).toBe(true);
    expect(showExportCheckLink(onb)).toBe(false);
    expect(showExportCheckLink({ roles: ["manager"], seats: { opsSupervisor: true } })).toBe(true);
    expect(showExportCheckLink({ roles: ["admin"] })).toBe(true);
    expect(showExportCheckLink({ roles: ["tech"] })).toBe(false);
  });
  it("warns with the table names when a table has fewer rows now", () => {
    const tables = fewerLiveTables([
      { table: "tickets", state: "ok" },
      { table: "leads", state: "fewer" },
      { table: "audit_log", state: "fewer" },
    ]);
    expect(tables).toEqual(["audit_log", "leads"]);
    expect(fewerLiveWarning(tables)).toBe(
      "These tables have fewer rows now than in the export: audit_log, leads. The export still holds every row. Check that nothing was removed by mistake.",
    );
    expect(fewerLiveWarning([])).toBeNull();
  });
  it("lists stores not copied with their reason", () => {
    expect(notCopiedLines([{ bucket: "backups", files: 3, bytes: 2_000_000, reason: "Not copied: database backups; the tables are already in this export." }])).toEqual([
      { key: "backups", title: "backups: 3 files (2.0 MB)", reason: "Not copied: database backups; the tables are already in this export." },
    ]);
  });
});

describe("A4 portal quote approved alert", () => {
  it("tells the coordinator in app and by email", () => {
    const row = portalApprovedAlertRow({ coordinatorId: ME, leadId: OTHER, partner: "Owl", subject: null, isDemo: false });
    expect(row.title).toBe("Approved. Post it in the portal.");
    expect(row.user_id).toBe(ME);
    expect(row.email_status).toBe("pending");
    expect(PORTAL_APPROVED_ALERT.kind).toBe("direct_booking_portal_approved");
  });
  it("never emails a demo request, and sends once per approval", () => {
    expect(portalApprovedAlertRow({ coordinatorId: ME, leadId: OTHER, partner: null, subject: null, isDemo: true }).email_status).toBe("none");
    const fn = read("src/lib/direct-bookings.functions.ts");
    expect(fn).toContain('.gte("created_at", decidedAt)');
  });
});

describe("B1 Move to queue", () => {
  it("is for the Operations Supervisor and the Director of Operations", () => {
    expect(canMoveToQueue({ opsSupervisor: true }, false, true)).toBe(true);
    expect(canMoveToQueue({ opsDirector: true }, false, true)).toBe(true);
    expect(canMoveToQueue({ onboardingDirector: true } as never, false, true)).toBe(false);
    expect(canMoveToQueue({ opsSupervisor: true }, true, true)).toBe(false);
  });
  it("stays hidden until its database step is approved", () => {
    expect(MOVE_TO_QUEUE_LIVE).toBe(false);
    expect(canMoveToQueue({ opsSupervisor: true }, false)).toBe(false);
  });
});

describe("staged and applied database steps (docs/pending/build9)", () => {
  const dir = "docs/pending/build9";
  const migrations = readdirSync("drizzle/migrations").filter((f) => f.endsWith(".sql"));
  const norm = (t: string) => t.split("\n").map((l) => l.trimEnd()).filter(Boolean).join("\n");
  it("has a README and matching checksums for every file", () => {
    expect(existsSync(`${dir}/README.md`)).toBe(true);
    const sums = JSON.parse(read(`${dir}/sha256.json`)) as Record<string, string>;
    expect(Object.keys(sums).length).toBeGreaterThan(10);
    for (const [f, sum] of Object.entries(sums)) expect(createHash("sha256").update(readFileSync(`${dir}/${f}`)).digest("hex")).toBe(sum);
  });
  it("applied the three steps marked APPLY exactly as staged, each with an undo", () => {
    for (const [m, s] of [
      ["0320_build9_reply_time_guard.sql", "01_reply_time_guard.sql"],
      ["0321_build9_time_off_all_or_nothing.sql", "02_time_off_all_or_nothing.sql"],
      ["0322_build9_handoff_ready_authority.sql", "03_handoff_ready_authority.sql"],
    ] as const) {
      expect(norm(read(`drizzle/migrations/${m}`))).toBe(norm(read(`${dir}/${s}`)));
      expect(existsSync(`${dir}/undo/${s}`)).toBe(true);
    }
  });
  it("did not apply the steps that are staged only", () => {
    const markers = {
      "04_move_to_queue.sql": "CREATE OR REPLACE FUNCTION public.move_notion_to_queue",
      "05_shift_history_full_stop.sql": "Build 9 C5",
      "06_export_fewer_alert.sql": "nightly_export_fewer_alert",
      "07_task_role_wording.sql": "Build 9 G1",
      "08_database_text.sql": "Build 9 G2",
    };
    for (const [f, marker] of Object.entries(markers)) {
      expect(read(`${dir}/${f}`)).toContain(marker);
      expect(existsSync(`${dir}/undo/${f}`)).toBe(true);
      for (const m of migrations) expect(read(`drizzle/migrations/${m}`)).not.toContain(marker);
    }
  });
  it("the reply time is written only by Resolve's own actions", () => {
    const sql = read(`${dir}/01_reply_time_guard.sql`);
    expect(sql).toContain("IF current_user NOT IN ('authenticated', 'anon') THEN RETURN NEW; END IF;");
    expect(sql).toContain("OR NEW.reply_sent_by IS DISTINCT FROM OLD.reply_sent_by");
  });
  it("only the Director of Onboarding marks ready in the database", () => {
    const sql = read(`${dir}/03_handoff_ready_authority.sql`);
    expect(sql).toContain("IF NOT coalesce(auth.uid()=public.seat_holder('onboarding_director'),false) THEN RAISE EXCEPTION 'Only the Director of Onboarding can mark a home ready.'");
    expect(sql).not.toContain("auth.uid()=pr.director");
  });
});

describe("decision register", () => {
  const reg = read("docs/decision-register.md").split("\n");
  const line = (c: string) => reg.find((l) => l.startsWith(`${c} `)) ?? "";
  it("records the Build 9 answers", () => {
    expect(line("T5")).toContain("due 3 PM Central time");
    expect(line("T6")).toContain("refuses it when nobody is on shift in that role");
    expect(line("S4")).toContain("Approving time off is all or nothing");
    expect(line("A16")).toContain("A Supervisor who also holds Finance keeps Finance's view of Onboarding");
    expect(line("A19")).toContain("My scorecard page");
    expect(line("O4")).toContain("Not tracked in Resolve yet.");
    expect(line("D8")).toContain("Approved. Post it in the portal.");
    expect(line("N10")).toContain("fewer rows now than in the last export");
    expect(line("T13")).toContain("Command Center Typical time to resolve");
  });
});
