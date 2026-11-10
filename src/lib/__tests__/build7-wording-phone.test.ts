import { describe, expect, it } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { TICKET_UNAVAILABLE, ticketAvailability } from "../ticket-availability";
import { helpSideFor } from "../help-position";
import { PRIORITIES, priorityMeta } from "../tickets";
import { urgencyWords } from "../record-work";
import { EMERGENCY_BASIS_LABELS } from "../emergency-vendor";

describe("removed or archived ticket links (Build 7, H6)", () => {
  it("uses the exact plain message", () => {
    expect(TICKET_UNAVAILABLE).toBe("This ticket is no longer available.");
  });
  it("a removed ticket is unavailable, never an error", () => {
    expect(ticketAvailability({ found: false, foundInOtherLens: false, archived: false, canRestore: false })).toBe("unavailable");
  });
  it("an archived ticket is unavailable to anyone who cannot restore it", () => {
    expect(ticketAvailability({ found: true, foundInOtherLens: false, archived: true, canRestore: false })).toBe("unavailable");
  });
  it("an Admin still opens an archived ticket to restore it", () => {
    expect(ticketAvailability({ found: true, foundInOtherLens: false, archived: true, canRestore: true })).toBe("open");
  });
  it("a ticket under the other demo or real lens keeps its existing message", () => {
    expect(ticketAvailability({ found: false, foundInOtherLens: true, archived: false, canRestore: false })).toBe("other_lens");
  });
  it("the ticket page renders the message instead of a toast error", () => {
    const page = readFileSync("src/routes/_authenticated/tickets.$ticketId.tsx", "utf8");
    expect(page).toContain('data-testid="ticket-unavailable"');
    expect(page).toContain("{TICKET_UNAVAILABLE}");
  });
});

describe("Help and feedback beside an open drawer (Build 7, H6)", () => {
  const W = 390;
  it("stays bottom right when nothing is open", () => expect(helpSideFor([], W)).toBeNull());
  it("moves left when a right drawer is open", () => expect(helpSideFor([{ left: 100, right: 390 }], W)).toBe("left"));
  it("moves right when the left menu is open", () => expect(helpSideFor([{ left: 0, right: 290 }], W)).toBe("right"));
  it("sits bottom left above a full width sheet", () => expect(helpSideFor([{ left: 0, right: 390 }], W)).toBe("left"));
  it("tapping Help never closes the drawer or window", () => {
    for (const f of ["src/components/ui/sheet.tsx", "src/components/ui/dialog.tsx"]) {
      const src = readFileSync(f, "utf8");
      expect(src).toContain('closest?.("[data-help-feedback]")');
      expect(src).toContain("keepOpenForHelp(e);");
    }
    const help = readFileSync("src/components/HelpFeedback.tsx", "utf8");
    expect(help).toContain('data-help-feedback=""');
    expect(help).toContain("pointer-events-auto");
  });
});

describe("phone menu and tap sizes (Build 7, H6)", () => {
  const shell = readFileSync("src/components/AppShell.tsx", "utf8");
  it("the left menu closes after a page is chosen on a phone", () => {
    expect(shell).toContain("<CloseMenuOnPageChange />");
    expect(shell).toMatch(/if \(isMobile && openMobile\) setOpenMobile\(false\)/);
    expect(shell.indexOf("<CloseMenuOnPageChange />")).toBeGreaterThan(shell.indexOf("<SidebarProvider>"));
  });
  it("Search Resolve and the top bar controls are 44px on every screen size", () => {
    expect(readFileSync("src/components/GlobalSearch.tsx", "utf8")).toContain('className="min-h-11 w-full');
    for (const f of [
      "src/components/AppShell.tsx",
      "src/components/ThemeToggle.tsx",
      "src/components/NotificationBell.tsx",
      "src/components/PortalSwitcher.tsx",
      "src/components/owner/OwnerNotificationBell.tsx",
      "src/components/nav/NavContext.tsx",
    ]) {
      expect({ f, shrinks: /md:min-h-9|md:min-w-9|md:h-9/.test(readFileSync(f, "utf8")) }).toEqual({ f, shrinks: false });
    }
    expect(shell).toContain('className="h-11 rounded-lg font-medium');
  });
});

describe("urgency words on screens (Build 7, H4)", () => {
  it("labels and short names are the words, the values stay p1 to p3", () => {
    expect(PRIORITIES.map((p) => p.value)).toEqual(["p1", "p2", "p3"]);
    expect(priorityMeta("p1").short).toBe("Right now");
    expect(priorityMeta("p2").label).toBe("Today");
    expect(priorityMeta("p3").short).toBe("Routine");
    expect(urgencyWords("p2")).toBe("Today");
    expect(EMERGENCY_BASIS_LABELS.p1).toBe("Right now Ticket");
  });
  it("no screen shows a priority code made from the value", () => {
    const offenders: string[] = [];
    const walk = (d: string) => {
      for (const n of readdirSync(d, { withFileTypes: true })) {
        const p = `${d}/${n.name}`;
        if (n.isDirectory()) {
          if (n.name !== "__tests__" && n.name !== "integrations") walk(p);
        } else if (/\.tsx?$/.test(n.name) && !/\.test\.tsx?$/.test(n.name)) {
          const src = readFileSync(p, "utf8");
          if (/priority\)?\??\.toUpperCase\(\)|Priority\(\w+\)\.toUpperCase\(\)/.test(src) && !p.endsWith("coach.server.ts")) offenders.push(p);
        }
      }
    };
    walk("src");
    expect(offenders).toEqual([]);
  });
});

describe("staged Standard plan wording (Build 7, item 4)", () => {
  const dir = "docs/pending/wording";
  it("is staged with undo, README and matching checksums", () => {
    for (const f of ["01_standard_plan_role_wording.sql", "undo/01_undo_standard_plan_role_wording.sql", "README.md", "SHA256SUMS"]) {
      expect(existsSync(`${dir}/${f}`)).toBe(true);
    }
    for (const line of readFileSync(`${dir}/SHA256SUMS`, "utf8").trim().split("\n")) {
      const [sum, file] = line.split(/\s+/);
      expect(createHash("sha256").update(readFileSync(`${dir}/${file}`)).digest("hex")).toBe(sum!);
    }
  });
  it("is not in the applied migrations", () => {
    const applied = existsSync("supabase/migrations") ? readdirSync("supabase/migrations") : [];
    expect(applied.some((f) => readFileSync(`supabase/migrations/${f}`, "utf8").includes("Build 7 item 4"))).toBe(false);
  });
  it("names roles, not people, in the new text", () => {
    const sql = readFileSync(`${dir}/01_standard_plan_role_wording.sql`, "utf8");
    const newText = [...sql.matchAll(/SET title = \$w\$([\s\S]*?)\$w\$,\n  detail = \$w\$([\s\S]*?)\$w\$/g)].map((m) => `${m[1] ?? ""}${m[2] ?? ""}`).join("\n");
    expect(newText.length).toBeGreaterThan(1000);
    expect(newText.replace(/kade@arealhomeaway\.com/g, "")).not.toMatch(/\b(Emily|Jimenez|Steve|Mike|Kade|James|Micah|Sinor|KD|Keim|Burleson)\b/);
    expect((sql.match(/^UPDATE public\.onboarding_template_tasks/gm) ?? []).length).toBe(9);
  });
});
