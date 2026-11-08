/**
 * "Record routine work" sits in the top bar right beside "Record work" on
 * every Operations page (Emily, Nov 8 2026). Checked through the real
 * permission model (ROLE_CAPABILITIES, canOpenPath) and the same rule the app
 * shell renders from.
 */
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { can, type AccessSeats, type AppRole } from "../permissions";
import { canOpenPath } from "../route-access";
import { topBarWorkActions } from "../shell-nav";

const OPS_PAGES = [
  "/dashboard",
  "/team-queue",
  "/tickets/abc-123",
  "/properties",
  "/property/p-1",
  "/direct-bookings",
  "/claims",
];

function actions(
  pathname: string,
  roles: AppRole[],
  opts: { seats?: AccessSeats; vendorMode?: boolean; ownerMode?: boolean; readOnly?: boolean } = {},
) {
  return topBarWorkActions(pathname, {
    can: (c) => can(roles, c, opts.seats),
    canOpen: (p) => canOpenPath(p, { roles, seats: opts.seats }),
    vendorMode: opts.vendorMode ?? roles.includes("vendor"),
    ownerMode: opts.ownerMode ?? roles.includes("owner"),
    readOnly: opts.readOnly ?? false,
  });
}

describe("who sees Record routine work in the top bar", () => {
  const opsPeople: Array<[string, AppRole[], AccessSeats | undefined]> = [
    ["Property Coordinator", ["tech"], undefined],
    ["Operations Supervisor", ["manager"], undefined],
    ["Director of Operations", ["manager"], { opsDirector: true }],
    ["Admin", ["admin"], undefined],
  ];

  for (const [label, roles, seats] of opsPeople) {
    it(`${label}: both buttons on every Operations page`, () => {
      for (const page of OPS_PAGES) {
        expect({ page, ...actions(page, roles, { seats }) }).toEqual({
          page,
          recordWork: true,
          recordRoutine: true,
        });
      }
    });
  }

  it("onboarding only, vendor and owner accounts see neither", () => {
    const pages = [...OPS_PAGES, "/onboarding", "/vendor", "/owner", "/hub"];
    for (const roles of [["onboarding"], ["vendor"], ["owner"]] as AppRole[][]) {
      for (const page of pages) {
        expect({ roles, page, ...actions(page, roles) }).toEqual({
          roles,
          page,
          recordWork: false,
          recordRoutine: false,
        });
      }
    }
  });

  it("routine work always follows Record work: same pages, never alone", () => {
    const pages = [...OPS_PAGES, "/tickets/new", "/onboarding", "/vendors", "/owner-programs"];
    for (const roles of [["tech"], ["manager"], ["admin"], ["onboarding"]] as AppRole[][]) {
      for (const page of pages) {
        const a = actions(page, roles);
        if (a.recordRoutine) expect(a.recordWork).toBe(true);
        if (a.recordWork) expect(a.recordRoutine).toBe(true);
      }
    }
  });

  it("a read only preview shows neither", () => {
    expect(actions("/dashboard", ["admin"], { readOnly: true })).toEqual({
      recordWork: false,
      recordRoutine: false,
    });
  });
});

describe("the top bar button opens the panel in place", () => {
  const shell = readFileSync("src/components/AppShell.tsx", "utf8");
  const bar = shell.slice(shell.indexOf('data-testid="top-bar-work-actions"'));
  const routineButton = bar.slice(bar.indexOf("{showRecordRoutine && ("), bar.indexOf("</Button>", bar.indexOf("{showRecordRoutine && (")));

  it("sits directly beside Record work, same size", () => {
    expect(bar.indexOf("Record work")).toBeGreaterThan(-1);
    expect(bar.indexOf("Record work")).toBeLessThan(bar.indexOf("{showRecordRoutine && ("));
    expect(routineButton).toContain('size="sm"');
    expect(routineButton).toContain('className="min-h-11 md:min-h-9"');
  });

  it("is a button that opens the overlay, not a link or a page change", () => {
    expect(routineButton).toContain("onClick={() => openRecordRoutine()}");
    expect(routineButton).not.toContain("<Link");
    expect(routineButton).not.toContain("navigate(");
    expect(routineButton).not.toContain("asChild");
  });

  it("shortens to Routine work on a phone, full words from small screens up", () => {
    expect(routineButton).toContain('<span className="sm:hidden">Routine work</span>');
    expect(routineButton).toContain('<span className="hidden sm:inline">Record routine work</span>');
    expect(routineButton).toContain('aria-label="Record routine work"');
  });

  it("the panel is mounted wherever the button shows", () => {
    expect(shell).toContain("(showRecordRoutine || (!ownerMode && !vendorMode && can(\"routines\"))) && <RecordRoutineHost />");
  });

  it("opening only sends an in-page event; the address stays the same", async () => {
    const target = new EventTarget();
    const location = { href: "http://localhost/team-queue?view=list", pathname: "/team-queue" };
    const g = globalThis as unknown as { window?: unknown; CustomEvent?: unknown };
    const prevWindow = g.window;
    g.window = Object.assign(target, { location });
    try {
      const { openRecordRoutine, RECORD_ROUTINE_EVENT } = await import(
        "@/components/routines/RecordRoutinePanel"
      );
      const seen: unknown[] = [];
      target.addEventListener(RECORD_ROUTINE_EVENT, (e) => seen.push((e as CustomEvent).detail));
      openRecordRoutine();
      expect(seen).toEqual([{}]);
      expect(location.href).toBe("http://localhost/team-queue?view=list");
    } finally {
      g.window = prevWindow;
    }
  });
});

describe("Home and the Routine Work page keep their own buttons", () => {
  it("Home still has Routine work due today with its button", () => {
    const home = readFileSync("src/routes/_authenticated/dashboard.tsx", "utf8");
    expect(home).toContain("openRecordRoutine()");
  });
  it("the Routine Work page keeps its button", () => {
    const page = readFileSync("src/routes/_authenticated/routines.tsx", "utf8");
    expect(page).toContain("Record routine work");
  });
});

describe("word check", () => {
  it("no banned words in the top bar", () => {
    const shell = readFileSync("src/components/AppShell.tsx", "utf8");
    const bar = shell.slice(shell.indexOf('data-testid="top-bar-work-actions"'), shell.indexOf("Alerts and escalations"));
    for (const w of [/\bseat\b/i, /\bHit\b/, /\bMedian\b/i]) expect(bar).not.toMatch(w);
  });
});
