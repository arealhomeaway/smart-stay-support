/**
 * Build 5 of 7: access fixes and the Supervisor handoff only view (Emily, Nov 7 to 9;
 * register A1, A4 to A14, A16, A20, M5, M6). Checked through the real permission model,
 * the same menu rules the app shell renders and the staged database files.
 */
import { describe, expect, it } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { can, capabilitiesFor, isFinanceOnly, type AccessSeats, type AppRole } from "../permissions";
import { canOpenPath, homePathFor, viewOnlyPath } from "../route-access";
import { operationsMenu, pageTabGroupFor, visiblePageTabs, type NavAccess } from "../shell-nav";
import { VIEW_AS_OPTIONS, seatsForPreview } from "../view-as";
import { PREVIEW_SEATS, PREVIEW_SEAT_LABEL } from "../demo-mode";
import { handoffOverviewRow, handoffsShown, readyByRole, sortHandoffs, HANDOFFS_COPY } from "../handoffs-overview";

const read = (p: string) => readFileSync(p, "utf8");
const P = (roles: AppRole[], seats: AccessSeats = {}) => ({ roles, seats });
const SUP = P(["manager"], { opsSupervisor: true });
const DIR_OPS = P(["manager"], { opsDirector: true });
const FIN = P(["manager"], { finance: true });
const DIR_ONB = P(["onboarding"], { onboardingDirector: true });
const ADMIN = P(["admin"]);
const PC = P(["tech"]);
const nav = (p: { roles: AppRole[]; seats: AccessSeats }): NavAccess => ({
  can: (c) => can(p.roles, c, p.seats),
  canOpen: (path) => canOpenPath(path, p),
  flagEnabled: () => false,
});
const labels = (p: { roles: AppRole[]; seats: AccessSeats }) =>
  operationsMenu(nav(p)).flatMap((g) => g.items.map((i) => i.label));

describe("1. The Operations Supervisor sees Onboarding only through the read only Handoffs page", () => {
  it("no Onboarding menu item, board, tasks, home pages or templates, by address too", () => {
    expect(labels(SUP)).not.toContain("Onboarding");
    expect(labels(SUP)).toContain("Handoffs");
    for (const path of ["/onboarding", "/onboarding/my-work", "/onboarding/templates", "/onboarding/abc", "/onboarding/handoff-standard"])
      expect(canOpenPath(path, SUP)).toBe(false);
    expect(canOpenPath("/handoffs", SUP)).toBe(true);
    expect(can(SUP.roles, "onboarding_workspace", SUP.seats)).toBe(false);
  });
  it("the Director of Operations keeps Onboarding and handoff acceptance; Handoffs stays out of the menu for them", () => {
    expect(canOpenPath("/onboarding", DIR_OPS)).toBe(true);
    expect(can(DIR_OPS.roles, "handoff_review", DIR_OPS.seats)).toBe(true);
    expect(labels(DIR_OPS)).toContain("Onboarding");
    expect(labels(DIR_OPS)).not.toContain("Handoffs");
    expect(canOpenPath("/handoffs", DIR_OPS)).toBe(true);
  });
  it("coordinators and onboarding roles do not open Handoffs", () => {
    for (const p of [PC, DIR_ONB, P(["onboarding"]), FIN]) expect(canOpenPath("/handoffs", p)).toBe(false);
  });
  it("the page reads the shared handoff standard and writes nothing", () => {
    const page = read("src/routes/_authenticated/handoffs.tsx");
    const fn = read("src/lib/handoffs-overview.functions.ts");
    expect(fn).toContain('rpc("read_home_handoff_standard"');
    expect(fn).toContain('Handoffs are for Operations leadership.');
    for (const src of [page, fn]) for (const write of [".insert(", ".update(", ".delete(", ".upsert(", "perform_handoff_step", "decide_home"]) expect(src).not.toContain(write);
    expect(page).toContain('<RequireCapability capability="handoffs_view"');
  });
});

describe("1. Handoffs page rows", () => {
  const project = (over: Partial<Parameters<typeof handoffOverviewRow>[0]["project"]> = {}) => ({
    id: "p1", property_id: "h1", handoff_state: "in_progress", status: "active", target_handoff_on: null,
    ready_for_ops_at: null, is_demo: false, ...over,
  });
  const standard = {
    available: true,
    requirements: [
      { id: "r1", code: "A", name: "Smart lock set", category: "Access", tier: "essential" as const, done_when: "", proof_needed: "", status: "adopted" as const, notes: "", sort_order: 1, template_step_ids: ["s1"] },
      { id: "r2", code: "B", name: "Wifi named", category: "Guest", tier: "essential" as const, done_when: "", proof_needed: "", status: "adopted" as const, notes: "", sort_order: 2, template_step_ids: ["s2"] },
    ],
    tasks: [
      { id: "t1", title: "Lock", status: "complete", template_task_id: "s1", due_on: null, assigned_seat: null, blocks_handoff: false },
      { id: "t2", title: "Wifi", status: "open", template_task_id: "s2", due_on: null, assigned_seat: null, blocks_handoff: false },
    ],
    decisions: [],
    carryovers: [],
  };
  const home = { primary: "815 E Fulton St", secondary: "Broken Arrow, OK" };
  it("shows the status, the Committed Handoff Date or Not set, and the items still open", () => {
    const r = handoffOverviewRow({ project: project(), home, lifecycleStatus: "onboarding", readyBy: null, standard });
    expect(r.status).toBe("Onboarding");
    expect(r.committedOn).toBeNull();
    expect(HANDOFFS_COPY.notSet).toBe("Not set");
    expect(r.openItems.map((i) => i.name)).toEqual(["Wifi named"]);
    expect(r.readyBy).toBeNull();
    const dated = handoffOverviewRow({ project: project({ target_handoff_on: "2026-11-20" }), home, lifecycleStatus: "onboarding", readyBy: null, standard });
    expect(dated.committedOn).toBe("2026-11-20");
  });
  it("names who marked it ready by role, never by name", () => {
    expect(readyByRole({ isAdmin: false, roleCodes: ["director_onboarding"] })).toBe("Director of Onboarding");
    expect(readyByRole({ isAdmin: true, roleCodes: ["coo"] })).toBe("Admin");
    expect(readyByRole({ isAdmin: false, roleCodes: ["onboarding_project_manager"] })).toBe("Project Manager");
    expect(readyByRole({ isAdmin: false, roleCodes: [] })).toBe("the Onboarding team");
    const r = handoffOverviewRow({ project: project({ handoff_state: "ready", ready_for_ops_at: "2026-11-09T15:00:00Z" }), home, lifecycleStatus: "onboarding", readyBy: "Director of Onboarding", standard });
    expect(r.status).toBe("Ready for handoff");
    expect(HANDOFFS_COPY.readyBy(r.readyBy!, "11/09/2026")).toBe("Marked ready by Director of Onboarding on 11/09/2026");
  });
  it("after handoff shows the carry over items, and drops a handed off home once none are open", () => {
    const carry = { ...standard, carryovers: [{ id: "c1", ticket_id: "k1", title: "Wifi named", status: "open", due_on: "2026-11-27" }] };
    const accepted = project({ handoff_state: "accepted" });
    const r = handoffOverviewRow({ project: accepted, home, lifecycleStatus: "active_operations", readyBy: null, standard: carry });
    expect(r.openItems).toEqual([]);
    expect(r.carryOvers.map((c) => c.title)).toEqual(["Wifi named"]);
    const done = handoffOverviewRow({ project: { ...accepted, id: "p2" }, home, lifecycleStatus: "active_operations", readyBy: null, standard });
    const cancelled = handoffOverviewRow({ project: project({ id: "p3", status: "cancelled" }), home, lifecycleStatus: "onboarding", readyBy: null, standard });
    const all = { p1: accepted, p2: { ...accepted, id: "p2" }, p3: project({ id: "p3", status: "cancelled" }) } as Record<string, ReturnType<typeof project>>;
    expect(handoffsShown([r, done, cancelled], (id) => all[id]).map((x) => x.projectId)).toEqual(["p1"]);
  });
  it("lists the soonest Committed Handoff Date first and homes with no date last", () => {
    const rows = [{ committedOn: null, home: "A" }, { committedOn: "2026-12-01", home: "B" }, { committedOn: "2026-11-20", home: "C" }];
    expect(sortHandoffs(rows).map((r) => r.home)).toEqual(["C", "B", "A"]);
  });
});

describe("2. Finance on a Supervisor type account", () => {
  it("is Finance only when no Supervisor, Director or Admin role sits on top", () => {
    expect(isFinanceOnly(FIN.roles, FIN.seats)).toBe(true);
    expect(isFinanceOnly(["manager"], { finance: true, opsSupervisor: true })).toBe(false);
    expect(isFinanceOnly(["manager"], { finance: true, opsDirector: true })).toBe(false);
    expect(isFinanceOnly(["admin"], { finance: true })).toBe(false);
  });
  it("A4 Home view, no Active Owner staff pages; A6, A7 Team Queue and Oversight hidden; A13 Schedule hidden", () => {
    expect(canOpenPath("/dashboard", FIN)).toBe(true);
    expect(viewOnlyPath("/dashboard", FIN)).toBe(true);
    for (const path of ["/owner-programs", "/owner-oversight", "/homeowners", "/owner-library", "/owner-analytics", "/owner", "/team-queue", "/oversight", "/supervisor-check", "/team", "/handoffs"])
      expect(canOpenPath(path, FIN)).toBe(false);
    expect(labels(FIN)).not.toContain("Team Queue");
    expect(labels(FIN)).not.toContain("Oversight");
    expect(labels(FIN)).not.toContain("Team and Coverage");
  });
  it("A8 Work orders view, A9 Vendors view, A10 Claims and refunds view, A12 Properties view", () => {
    for (const path of ["/work-orders", "/vendors", "/claims", "/recovery", "/properties", "/property/abc"]) {
      expect(canOpenPath(path, FIN)).toBe(true);
      expect(viewOnlyPath(path, FIN)).toBe(true);
    }
    expect(canOpenPath("/work-orders/manager", FIN)).toBe(false);
    const caps = capabilitiesFor(FIN.roles, FIN.seats);
    for (const c of ["work_orders_internal", "vendor_admin", "vendor_leadership", "claims_oversight", "routines", "ticket_create"] as const) expect(caps.has(c)).toBe(false);
    expect(caps.has("work_orders_view")).toBe(true);
  });
  it("A11 Direct Bookings stays open and A18 Finance pages edit", () => {
    for (const path of ["/direct-bookings", "/finance"]) {
      expect(canOpenPath(path, FIN)).toBe(true);
      expect(viewOnlyPath(path, FIN)).toBe(false);
    }
    expect(can(FIN.roles, "finance_workspace", FIN.seats)).toBe(true);
    expect(can(FIN.roles, "direct_bookings_work", FIN.seats)).toBe(true);
  });
  it("the page read only rule reaches every screen through useRole", () => {
    expect(read("src/hooks/useRole.ts")).toContain("const viewOnlyHere = viewOnlyPath(pathname, access);");
  });
});

describe("3. Onboarding roles", () => {
  it("A12: the Director of Onboarding, Project Manager, Utilities and Design open the Properties list", () => {
    for (const seats of [{ onboardingDirector: true }, { projectManager: true }, { utilities: true }, {}]) {
      expect(canOpenPath("/properties", P(["onboarding"], seats))).toBe(true);
      expect(canOpenPath("/property/abc", P(["onboarding"], seats))).toBe(true);
    }
  });
  it("A14: only the Director of Onboarding adds Onboarding staff", () => {
    expect(can(DIR_ONB.roles, "onboarding_user_invite", DIR_ONB.seats)).toBe(true);
    for (const p of [P(["onboarding"], { projectManager: true }), P(["onboarding"]), PC, SUP, FIN]) expect(can(p.roles, "onboarding_user_invite", p.seats)).toBe(false);
    const team = read("src/routes/_authenticated/team.tsx");
    expect(team).toContain('<TeamInvitePanel allowedRoles={["onboarding"]} />');
  });
  it("A5: onboarding accounts never see Record routine work or the Team Queue link on Home", () => {
    for (const seats of [{ onboardingDirector: true }, { projectManager: true }, { utilities: true }, {}]) {
      expect(can(["onboarding"], "routines", seats)).toBe(false);
      expect(can(["onboarding"], "team_queue", seats)).toBe(false);
    }
    const home = read("src/routes/_authenticated/dashboard.tsx");
    expect(home).toContain('can("team_queue") ? (');
  });
});

describe("4. Admin menu and pages", () => {
  const adminTabs = (p: { roles: AppRole[]; seats: AccessSeats }) =>
    visiblePageTabs(pageTabGroupFor("/help-tickets")!, nav(p)).map((t) => t.label);
  it("the Supervisor and the Director see only Help Tickets from the Admin group", () => {
    for (const p of [SUP, DIR_OPS]) {
      expect(adminTabs(p)).toEqual(["Help Tickets"]);
      for (const path of ["/integrations", "/integrations/notion-import", "/audit", "/imported-tickets", "/oversight-access-log"])
        expect(canOpenPath(path, p)).toBe(false);
      const admin = operationsMenu(nav(p)).find((g) => g.label === "Admin");
      expect(admin?.items.map((i) => i.to)).toEqual(["/help-tickets"]);
    }
  });
  it("the Admin keeps every Admin page", () => {
    for (const path of ["/integrations", "/integrations/notion-import", "/audit", "/imported-tickets", "/oversight-access-log", "/help-tickets"])
      expect(canOpenPath(path, ADMIN)).toBe(true);
    // Build 6 (N10): the Admin also gets the read only Export check under Admin tools. Build 13: Bonus settings.
    expect(adminTabs(ADMIN)).toEqual(["Integrations", "Audit History", "Help Tickets", "Notion import", "Export check", "Bonus settings"]);
  });
  it("Audit history data is Admin only on the server too", () => {
    const fn = read("src/lib/onboarding.functions.ts");
    expect(fn).toContain('if (error || !allowed) throw new Error("Audit history is for the Admin.");');
  });
  it("the Director of Operations no longer changes help ticket status", () => {
    const guard = read("src/lib/help-ticket-response.server.ts");
    expect(guard).not.toContain("is_director");
    expect(guard).toContain('throw new Error("Only the Admin can manage help tickets.")');
    expect(read("src/routes/_authenticated/help-tickets.tsx")).toContain('const canBulk = !readOnly && roles.includes("admin");');
  });
});

describe("5. Help tickets: My reports", () => {
  it("every staff member opens their own reports; owners and vendors do not", () => {
    for (const p of [PC, SUP, DIR_OPS, FIN, DIR_ONB, P(["onboarding"]), ADMIN]) expect(canOpenPath("/help-tickets", p)).toBe(true);
    for (const p of [P(["owner"]), P(["vendor"])]) expect(canOpenPath("/help-tickets", p)).toBe(false);
  });
  it("is reached from the help button and the account page, and shows only their own unless Admin", () => {
    const help = read("src/components/HelpFeedback.tsx");
    expect(help).toContain("My reports");
    expect(read("src/routes/_authenticated/account.tsx")).toContain("My reports");
    const page = read("src/routes/_authenticated/help-tickets.tsx");
    expect(page).toContain("if (!isAdmin) return <MyReports rows={data ?? []} isLoading={isLoading} />;");
    expect(page).toContain('if (ownOnly) query = query.eq("submitted_by", ownOnly);');
  });
  it("the thank you line has no long dash", () => {
    const help = read("src/components/HelpFeedback.tsx");
    expect(help).toContain('toast.success("Thanks. Your feedback was sent.");');
    expect(help).not.toContain("Thanks \u2014");
  });
});

describe("6. View as: every role, keeping its role on top, still read only", () => {
  it("lists every role and maps each to the real account and role on top", () => {
    const shape = VIEW_AS_OPTIONS.map((o) => [o.label, o.role, JSON.stringify(seatsForPreview(o.seat))]);
    expect(shape).toEqual([
      ["Property Coordinator", "tech", "{}"],
      ["Operations Supervisor", "manager", '{"opsSupervisor":true}'],
      ["Director of Operations", "manager", '{"opsDirector":true}'],
      ["Director of Onboarding", "onboarding", '{"onboardingDirector":true}'],
      ["Project Manager", "onboarding", '{"projectManager":true}'],
      ["Utilities", "onboarding", '{"utilities":true}'],
      ["Design", "onboarding", "{}"],
      ["Finance lead", "manager", '{"finance":true}'],
    ]);
    for (const seat of PREVIEW_SEATS) expect(PREVIEW_SEAT_LABEL[seat]).toBeTruthy();
  });
  it("the preview lands where the real role lands and follows the same page rule", () => {
    const opt = (label: string) => VIEW_AS_OPTIONS.find((o) => o.label === label)!;
    const as = (label: string) => ({ roles: [opt(label).role], seats: seatsForPreview(opt(label).seat) });
    expect(canOpenPath("/onboarding", as("Operations Supervisor"))).toBe(false);
    expect(canOpenPath("/handoffs", as("Operations Supervisor"))).toBe(true);
    expect(canOpenPath("/team", as("Finance lead"))).toBe(false);
    expect(homePathFor(as("Director of Onboarding"))).toBe("/onboarding");
    const role = read("src/hooks/useRole.ts");
    expect(role).toContain("? seatsForPreview(previewSeat)");
    expect(role).toContain("readOnly: (previewing && !demoMode) || viewOnlyHere,");
    expect(read("src/components/AppShell.tsx")).toContain("{previewing && !canOpen(livePathname) ? (");
  });
});

describe("7. Staged database change", () => {
  const dir = "docs/pending/access-fixes/";
  it("applied byte for byte and matches its checksums", () => {
    expect(read("drizzle/migrations/0317_access_fixes.sql")).toBe(read(`${dir}01_access_fixes.sql`));
    const sums = read(`${dir}sha256.txt`).trim().split("\n").map((l) => l.split(/\s+/));
    expect(sums.length).toBeGreaterThan(3);
    for (const [hash, file] of sums) expect(createHash("sha256").update(readFileSync(`${dir}${file}`)).digest("hex")).toBe(hash!);
  });
  it("Admin only help ticket management, own reports for everyone; Onboarding invites for the Director of Onboarding", () => {
    const sql = read(`${dir}01_access_fixes.sql`);
    const help = sql.slice(0, sql.indexOf("-- A14"));
    expect(help).not.toContain("is_director");
    expect(help).toContain("OR submitted_by = auth.uid()");
    expect(sql).toContain("WITH CHECK (role = 'onboarding'::app_role AND public.is_onboarding_director(auth.uid()));");
    expect(sql).toContain("AND NOT public.holds_functional_role(_uid, 'ops_supervisor')");
  });
  it("the undo puts back the live rules exactly", () => {
    const undo = read(`${dir}01_undo_access_fixes.sql`);
    const live = read(`${dir}live-capture/private.home_profile_editor.sql`);
    expect(undo).toContain("OR is_director(auth.uid()) OR (submitted_by = auth.uid())");
    expect(undo).toContain('DROP POLICY IF EXISTS "Director of Onboarding creates Onboarding invites" ON public.team_invites;');
    // The live capture ends at $function$ (as pg_get_functiondef prints it); the undo adds the semicolon.
    const body = (s: string) => {
      const start = s.indexOf("CREATE OR REPLACE FUNCTION private.home_profile_editor");
      return s.slice(start, s.indexOf("$function$", s.indexOf("AS $function$", start) + 13) + 10);
    };
    expect(body(live).length).toBeGreaterThan(400);
    expect(body(undo)).toBe(body(live));
  });
});
