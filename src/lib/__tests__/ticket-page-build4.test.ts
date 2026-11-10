import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { dueText, lateSpan, nextStepHistoryLine, nextStepProblem, nextStepView } from "../ticket-next-step";
import { CLOSE_REOPEN_COPY, closeReopenState } from "../ticket-close-reopen";
import { ticketCurrentAction } from "../ticket-current-action";
import { ticketNextAction } from "../ticket-next-action";
import { minutesExcludingWaiting, waitingSpans } from "../waiting-time";
import { ONE_TOUCH_DID, oneTouchOutcome } from "../record-work";

const read = (p: string) => readFileSync(p, "utf8");
const PAGE = read("src/routes/_authenticated/tickets.$ticketId.tsx");

// A fixed local clock: Tue Nov 10 2026, 10:00 in the viewer's own time.
const NOW = new Date(2026, 10, 10, 10, 0, 0);
const at = (h: number, m = 0, dayOffset = 0) => new Date(2026, 10, 10 + dayOffset, h, m, 0).toISOString();

describe("Do this now: one next step with a due time (T5, T13)", () => {
  test("the current action becomes the next step with its due time", () => {
    const v = nextStepView({ derivedLabel: "Check the approval", derivedDueAt: at(15) }, NOW);
    expect(v?.line).toBe("Next step: check the approval, due 3 PM");
    expect(v?.late).toBe(false);
    expect(v?.custom).toBe(false);
  });
  test("late work says how late: Start work: 3 days late", () => {
    const v = nextStepView({ derivedLabel: "Start work", derivedDueAt: at(10, 0, -3) }, NOW);
    expect(v?.line).toBe("Start work: 3 days late");
    expect(v?.late).toBe(true);
  });
  test("a step a person wrote wins over the suggested step, with its own due time", () => {
    const v = nextStepView(
      { customStep: "Call the owner about the quote", customDueAt: at(9, 30, 1), derivedLabel: "Start work", derivedDueAt: at(9) },
      NOW,
    );
    expect(v?.line).toBe("Next step: Call the owner about the quote, due tomorrow 9:30 AM");
    expect(v?.custom).toBe(true);
  });
  test("a written step with no due time shows no due time", () => {
    expect(nextStepView({ customStep: "Wait for photos", derivedDueAt: at(15) }, NOW)?.line).toBe("Next step: Wait for photos");
  });
  test("nothing to show when there is no step", () => {
    expect(nextStepView({ derivedLabel: null }, NOW)).toBeNull();
  });
  test("late spans and due words", () => {
    expect(lateSpan(5 * 60000)).toBe("5 min");
    expect(lateSpan(60 * 60000)).toBe("1 hour");
    expect(lateSpan(5 * 3600000)).toBe("5 hours");
    expect(lateSpan(3 * 86400000)).toBe("3 days");
    expect(dueText(new Date(2026, 10, 12, 15, 0), NOW)).toBe("Thu 11/12, 3 PM");
  });
  test("a change needs a real step and a real due time", () => {
    expect(nextStepProblem("ok", "")).not.toBeNull();
    expect(nextStepProblem("x".repeat(201), "")).not.toBeNull();
    expect(nextStepProblem("Check the approval", "not a date")).not.toBeNull();
    expect(nextStepProblem("Check the approval", "2026-11-10T15:00")).toBeNull();
  });
  test("every change writes one history line", () => {
    const f = () => "11/10/2026 3:00 PM";
    expect(nextStepHistoryLine("Check the approval", "2026-11-10T21:00:00Z", f)).toBe("Next step changed: Check the approval. Due 11/10/2026 3:00 PM.");
    expect(nextStepHistoryLine("Check the approval", null, f)).toBe("Next step changed: Check the approval. No due time.");
    expect(nextStepHistoryLine(null, null, f)).toBe("Next step done. Back to the suggested step.");
  });
  test("a change is saved on the ticket's own next step fields, recorded with who and when, and never starts a clock", () => {
    const card = read("src/components/tickets/NextStepCard.tsx");
    expect(card).toContain("next_action: nextAction, next_action_due_at: dueIso");
    expect(card).toContain('event_type: "next_step_changed"');
    expect(card).toContain("author_id: userData.user.id");
    expect(card).not.toContain("ensureTicketActionStarted");
    expect(card).not.toMatch(/acknowledged_at|action_started_at|response_due_at|action_due_at/);
    // who and when also land in the add-only state log through the existing trigger
    expect(read("drizzle/migrations/0270_ticket_times_and_states.sql")).toContain("AFTER INSERT OR UPDATE OF next_action, next_action_due_at");
  });
  test("the ticket page shows the step inside Do this now", () => {
    expect(PAGE).toContain("<NextStepCard ticketId={ticketId} view={nextStep}");
    expect(PAGE).toContain("derivedLabel: currentAction?.title ?? null");
  });
});

describe("New wording replaces Acknowledge this ticket, Start the work and Continue work", () => {
  const base = { status: "open", acknowledged_at: null, action_started_at: null };
  test("ticket and drawer card", () => {
    const ack = ticketCurrentAction(base);
    expect(ack?.title).toBe("Confirm you have it");
    expect(ack?.completeLabel).toBe("Continue");
    const start = ticketCurrentAction({ ...base, acknowledged_at: "2026-11-10T00:00:00Z" });
    expect(start?.title).toBe("Start work");
    expect(start?.completeLabel).toBe("Continue");
  });
  test("Home", () => {
    expect(ticketNextAction(base)?.label).toBe("Confirm you have it");
    expect(ticketNextAction({ ...base, acknowledged_at: "2026-11-10T00:00:00Z" })?.label).toBe("Start work");
  });
  test("the old words appear nowhere in the app", () => {
    const walk = (dir: string, out: string[] = []) => {
      for (const n of readdirSync(dir)) {
        const p = join(dir, n);
        if (statSync(p).isDirectory()) { if (n !== "__tests__") walk(p, out); }
        else if (/\.tsx?$/.test(n) && !/\.test\.tsx?$/.test(n)) out.push(p);
      }
      return out;
    };
    const hits = walk("src").filter((p) => {
      const s = read(p);
      return ["Acknowledge this ticket", "Start the work", "Continue work", "Acknowledge & advance", "Start & advance"].some((t) => s.includes(t));
    });
    expect(hits).toEqual([]);
  });
});

describe("Close ticket and Reopen ticket in the header (T12)", () => {
  const input = { status: "in_progress", archived: false, recordType: null, canWorkTickets: true, onboardingOnly: false, reopenPath: null } as const;
  test("an open ticket: Close enabled, Reopen disabled with a plain reason", () => {
    const s = closeReopenState(input);
    expect(s?.close).toEqual({ enabled: true, reason: null });
    expect(s?.reopen).toEqual({ enabled: false, reason: "Reopen is available once the ticket is closed." });
  });
  test("a closed ticket: Reopen enabled, Close disabled with a plain reason", () => {
    const s = closeReopenState({ ...input, status: "closed", reopenPath: "closed" });
    expect(s?.reopen.enabled).toBe(true);
    expect(s?.close).toEqual({ enabled: false, reason: CLOSE_REOPEN_COPY.closeWhenClosed });
  });
  test("finished work waiting for review can be reopened, not closed again", () => {
    const s = closeReopenState({ ...input, status: "resolved", reopenPath: "resolved" });
    expect(s?.reopen.enabled).toBe(true);
    expect(s?.close.enabled).toBe(false);
  });
  test("archived and imported tickets keep both shown, both disabled or pointed at the import box", () => {
    expect(closeReopenState({ ...input, archived: true })).toEqual({
      close: { enabled: false, reason: CLOSE_REOPEN_COPY.archived },
      reopen: { enabled: false, reason: CLOSE_REOPEN_COPY.archived },
    });
    expect(closeReopenState({ ...input, status: "closed", reopenPath: "notion" })?.reopen.reason).toBe(CLOSE_REOPEN_COPY.notion);
  });
  test("onboarding accounts and people who cannot work tickets see neither", () => {
    expect(closeReopenState({ ...input, onboardingOnly: true })).toBeNull();
    expect(closeReopenState({ ...input, canWorkTickets: false })).toBeNull();
  });
  test("both buttons are always rendered, 44px, and the page wires them to the existing close and reopen paths", () => {
    const btns = read("src/components/tickets/CloseReopenButtons.tsx");
    expect((btns.match(/className="min-h-11"/g) ?? []).length).toBe(2);
    expect(btns).toContain("CLOSE_REOPEN_COPY.close");
    expect(btns).toContain("CLOSE_REOPEN_COPY.reopen");
    expect(PAGE).toContain('if (reopenPath === "resolved") void reopen();');
    expect(PAGE).toContain('else if (reopenPath === "closed") setReopenOpen(true);');
    expect(PAGE).toContain("!role.onboardingOnly");
  });
});

describe("Waiting never counts against the person (T13)", () => {
  test("the Waiting card says the response timer is paused until the review time", () => {
    expect(PAGE).toContain("The response timer is paused until then.");
    // a future review time is still required to park a ticket
    expect(PAGE).toContain("The review time has to be in the future");
  });
  test("waiting minutes are taken out of a resolve time", () => {
    const spans = waitingSpans([
      { ticket_id: "t", change: "started", recorded_at: "2026-11-10T11:00:00Z" },
      { ticket_id: "t", change: "updated", recorded_at: "2026-11-10T12:00:00Z" },
      { ticket_id: "t", change: "ended", recorded_at: "2026-11-10T14:00:00Z" },
    ]);
    // 10:00 to 16:00 is 6 hours; 3 of them were waiting.
    expect(minutesExcludingWaiting("2026-11-10T10:00:00Z", "2026-11-10T16:00:00Z", spans.get("t"))).toBe(180);
  });
  test("a span still open at resolve time stops at resolve time", () => {
    const spans = waitingSpans([{ ticket_id: "t", change: "started", recorded_at: "2026-11-10T15:00:00Z" }]);
    expect(minutesExcludingWaiting("2026-11-10T10:00:00Z", "2026-11-10T16:00:00Z", spans.get("t"))).toBe(300);
  });
  test("no waiting means the full time", () => {
    expect(minutesExcludingWaiting("2026-11-10T10:00:00Z", "2026-11-10T11:00:00Z", undefined)).toBe(60);
  });
  test("Analytics team and per person resolve times use the waiting-free time", () => {
    const src = read("src/lib/ops-analytics.server.ts");
    expect(src).toContain('.from("ticket_state_log")');
    expect(src).not.toMatch(/minutesBetween\(t\.reported_at, t\.resolved_at/);
    expect(src).toContain("a.resolutionMinutes.push(resolveMinutesFor(t))");
  });
});

describe("One touch asks What did you do? (T11)", () => {
  test("the line is required and saved as the entry's outcome", () => {
    expect(oneTouchOutcome("")).toBeNull();
    expect(oneTouchOutcome("   ")).toBeNull();
    expect(oneTouchOutcome("  Reset   the breaker ")).toBe("Reset the breaker");
    expect(oneTouchOutcome("x".repeat(400))?.length).toBe(ONE_TOUCH_DID.max);
    const panel = read("src/routes/_authenticated/tickets.new.tsx");
    expect(panel).toContain("ONE_TOUCH_DID.label");
    expect(ONE_TOUCH_DID.label).toBe("What did you do?");
    const oneTouch = panel.slice(panel.indexOf("async function onOneTouch"), panel.indexOf("function toggleSpeak"));
    expect(oneTouch).toContain("outcome: did,");
    expect(oneTouch).not.toContain('from("tickets")');
    expect(oneTouch).not.toContain("due_at");
  });
  test("the repeat line detail shows what was done", () => {
    const flags = read("src/components/work-entry/HomeRepeatFlags.tsx");
    expect(flags).toContain("What you did:");
    expect(flags).toContain('.eq("problem_type_id", flag.work_type_id)');
  });
});
