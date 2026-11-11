import { describe, expect, it as test } from "bun:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  activityCategoryFor,
  insuranceRiskFromText,
  NOT_SURE_PROBLEM,
  repeatLine,
  understandRecordWork,
  urgencyWords,
  whoWillDoIt,
} from "../record-work";

// The live work types (Nov 9), used as the problem types until the 20 problem types list (T10) exists.
const catalog = [
  ["Current or past guest request", "guest", "p2"],
  ["New booking request", "guest", "p1"],
  ["Arrival information", "guest", "p1"],
  ["Tenant lead tracker", "guest", "p3"],
  ["OwnerRez booking blocks", "admin", "p2"],
  ["Guest review, survey and rating logs", "quality", "p3"],
  ["Claims", "claims", "p3"],
  ["Tone-check call", "guest", "p3"],
  ["Property or owner information update", "owner", "p2"],
  ["Adding homes to portals", "admin", "p3"],
  ["Immediate maintenance", "maintenance", "p1"],
  ["Ongoing maintenance", "maintenance", "p2"],
  ["Immediate cleaning need", "cleaning", "p1"],
  ["Ongoing cleaning need", "cleaning", "p2"],
  ["Cleaning Review Log", "quality", "p3"],
  ["Lock offline or low-battery alert", "access", "p2"],
  ["Breezeway task-reporting issue", "admin", "p2"],
  ["Maintenance and landscaping work-order review", "maintenance", "p3"],
  ["Quarterly inspection review", "quality", "p3"],
  ["Internal interdepartmental communication", "admin", "p3"],
  ["Escalated owner issue", "owner", "p2"],
].map(([name, category, default_priority], i) => ({ id: `wt-${i}`, name: name!, category: category!, default_priority: default_priority! }));

const read = (text: string, occupancy: string | null = "vacant", chosenWorkTypeId: string | null = null) =>
  understandRecordWork({ text, catalog, occupancy, chosenWorkTypeId });

describe("Resolve understood: the board's examples", () => {
  test("the refrigerator with a guest in the home: Immediate maintenance, repair Yes, Today, guest reason, no insurance box", () => {
    const u = read("The refrigerator is not cold.", "occupied");
    expect(u.problem).toBe("Immediate maintenance");
    expect(u.repair).toBe("yes");
    expect(u.entryKind).toBe("maintenance");
    expect(urgencyWords(u.priority)).toBe("Today");
    expect(u.reason).toBe("Urgent level is set because a guest is in the home.");
    expect(u.insurance).toBe(false);
    expect(u.maintenanceCategory).toBe("appliance");
  });
  test("the refrigerator in an empty home stays Today under the real urgency rule (the work type is Right now, capped at Today)", () => {
    const u = read("The refrigerator is not cold.", "vacant");
    expect(u.priority).toBe("p2");
    expect(u.guestImpact).toBe("none");
  });
  test("a guest in the home counts as affected automatically (T9)", () => {
    expect(read("The refrigerator is not cold.", "occupied").guestImpact).toBe("active_guest_affected");
    expect(read("The refrigerator is not cold.", "same_day_departure").guestImpact).toBe("active_guest_affected");
    expect(read("The refrigerator is not cold.", "vacant").guestImpact).toBe("none");
  });
  test("the lockout with the code given: lock problem, repair No (Ops label), Right now", () => {
    const u = read("Guest locked out, I gave them the backup code.", "occupied");
    expect(u.problem).toBe("Lock offline or low-battery alert");
    expect(u.repair).toBe("no");
    expect(u.entryKind).toBe("ops");
    expect(urgencyWords(u.priority)).toBe("Right now");
    expect(u.insurance).toBe(false);
  });
  test("locked out is Right now even with no reservation showing", () => {
    expect(read("Cleaner is locked out of the home.", "vacant").priority).toBe("p1");
  });
  test("the flooding: repair Yes, Right now, insurance box", () => {
    const u = read("Water is flooding the kitchen floor.", "vacant");
    expect(u.problem).toBe("Immediate maintenance");
    expect(u.repair).toBe("yes");
    expect(u.entryKind).toBe("maintenance");
    expect(u.priority).toBe("p1");
    expect(u.insurance).toBe(true);
    expect(u.maintenanceCategory).toBe("water_intrusion");
  });
  test("the towels: guest request, repair No, Today with a guest in the home", () => {
    const u = read("Guest needs more towels.", "occupied");
    expect(u.problem).toBe("Current or past guest request");
    expect(u.repair).toBe("no");
    expect(u.entryKind).toBe("ops");
    expect(u.priority).toBe("p2");
    expect(u.insurance).toBe(false);
  });
  test("anything Resolve cannot read is Not sure yet and a supervisor sorts it", () => {
    const u = read("Something odd happened at the home.");
    expect(u.problem).toBe(NOT_SURE_PROBLEM);
    expect(u.repair).toBe("not_sure");
    expect(u.entryKind).toBe("ops");
    expect(u.workType).toBeNull();
    expect(whoWillDoIt({ who_kind: "supervisor" }, false)).toBe("A supervisor will sort it");
  });
});

describe("Insurance warning words (flooding, fire, smoke, storm, roof, structural)", () => {
  for (const text of ["The basement flooded", "Small kitchen fire", "Smoke in the hallway", "Storm took shingles", "Roof is leaking", "Structural crack in the wall"])
    test(text, () => expect(insuranceRiskFromText(text)).toBe(true));
  for (const text of ["The refrigerator is not cold.", "Guest needs more towels.", "Guest locked out"])
    test(`no box: ${text}`, () => expect(insuranceRiskFromText(text)).toBe(false));
  test("fire stores the fire or smoke category on the Maintenance label", () => {
    expect(read("Fire in the oven, it is out now but the wall is burned").maintenanceCategory).toBe("appliance");
    expect(read("Smoke damage after a fire", "vacant", "wt-10").maintenanceCategory).toBe("fire_smoke");
  });
});

describe("Change the problem uses the existing work types", () => {
  test("picking another problem type sets the label from it", () => {
    const u = read("The refrigerator is not cold.", "vacant", "wt-0");
    expect(u.problem).toBe("Current or past guest request");
    expect(u.repair).toBe("no");
    expect(u.entryKind).toBe("ops");
  });
  test("picking a maintenance type sets Repair Yes and the Maintenance label", () => {
    const u = read("Something odd happened at the home.", "vacant", "wt-11");
    expect(u.repair).toBe("yes");
    expect(u.entryKind).toBe("maintenance");
    expect(u.priority).toBe("p2");
  });
  test("a changed problem drops the text's safety answer", () => {
    expect(read("Guest locked out", "vacant", "wt-0").guestImpact).toBe("none");
  });
});

describe("Who will do it, in plain words", () => {
  test("coordinator", () => expect(whoWillDoIt({ who_kind: "coordinator" }, true)).toBe("Property Coordinator on duty"));
  test("overnight on call", () => expect(whoWillDoIt({ who_kind: "on_call" }, true)).toBe("The person on call tonight"));
  test("supervisor with a problem type", () => expect(whoWillDoIt({ who_kind: "supervisor" }, true)).toBe("Operations Supervisor"));
  test("another role by its role name", () => expect(whoWillDoIt({ who_kind: "role", role_name: "Director of Operations" }, true)).toBe("Director of Operations"));
  test("nobody", () => expect(whoWillDoIt({ who_kind: "nobody" }, true)).toBe("A supervisor will sort it"));
});

describe("Repeat line and one touch filing", () => {
  test("board wording", () => expect(repeatLine("Appliance not working", 2, 90)).toBe("Appliance not working: 2 times in 90 days at this home."));
  test("one time", () => expect(repeatLine("Guest locked out", 1, 90)).toBe("Guest locked out: 1 time in 90 days at this home."));
  test("one touch history category", () => {
    expect(activityCategoryFor("maintenance")).toBe("property_condition");
    expect(activityCategoryFor("access")).toBe("access");
    expect(activityCategoryFor(null)).toBe("other");
  });
});

const PANEL = readFileSync("src/routes/_authenticated/tickets.new.tsx", "utf8");
const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

describe("The Record work panel", () => {
  test("opens straight on the form: no three card chooser", () => {
    expect(PANEL).not.toContain("ENTRY_KINDS");
    expect(PANEL).not.toContain("ModeCard");
    expect(PANEL).not.toContain("What are you recording?");
    for (const text of ["Which home?", "Describe the problem or request.", "Add photo", "Speak",
      "Short sentences are fine. Example: The refrigerator is not cold.", "Resolve understood</strong>", "Change the problem",
      "Repair needed at the home", "How urgent", "Who will do it",
      "This could be an insurance claim. Escalate this ticket before taking action.", "Escalate now",
      "A supervisor has been told. Wait for their answer before you act.", "Create ticket",
      "One touch: nothing more to do. Save to home history.", "Ticket created.", "Saved to home history.",
      "Open ticket", "Record another at this home", "Ask the Coach"])
      expect(PANEL).toContain(text);
  });
  test("the label is set from Repair needed at the home, never asked", () => {
    expect(PANEL).toContain("entry_kind: entryKind");
    expect(PANEL).toContain("const entryKind = understood.entryKind");
  });
  test("one touch writes home history only: no ticket insert, no clocks", () => {
    const oneTouch = PANEL.slice(PANEL.indexOf("async function onOneTouch"), PANEL.indexOf("function toggleSpeak"));
    expect(oneTouch).toContain('from("property_activity_log").insert');
    expect(oneTouch).toContain("one_touch: true");
    expect(oneTouch).not.toContain('from("tickets")');
    expect(oneTouch).not.toContain("due_at");
    expect(oneTouch).not.toContain("createTicket");
  });
  test("Create ticket and One touch wait for a home and a description", () => {
    expect(PANEL).toContain("const ready = Boolean(propertyId) && description.trim().length > 0;");
    // Create ticket and Escalate wait for a home and a description; One touch
    // also waits for What did you do? (register T11, Nov 10).
    expect((PANEL.match(/disabled=\{!ready \|\| saving !== null\}/g) ?? []).length).toBe(2);
    expect((PANEL.match(/disabled=\{!ready \|\| saving !== null \|\| !oneTouchOutcome\(didWhat\)\}/g) ?? []).length).toBe(1);
  });
  test("a ticket is created once: a second press reuses the same ticket", () => {
    expect(PANEL).toContain("if (createdTicketId) return createdTicketId;");
  });
  test("the escalate path calls the database step that alerts the Operations Supervisor", () => {
    expect(PANEL).toContain('"record_work_escalate"');
  });
  test("word check: no seat, no sample, no Median, no long dashes on the screen", () => {
    const screen = stripComments(PANEL);
    expect(screen).not.toMatch(/\bseats?\b/i);
    expect(screen).not.toMatch(/\bsample\b/i);
    expect(screen).not.toMatch(/\bMedian\b/);
    expect(screen).not.toContain("\u2014");
  });
});

function walk(dir: string, out: string[] = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx?|css)$/.test(name) && !p.includes("__tests__")) out.push(p);
  }
  return out;
}

test("the old three card text no longer appears anywhere in the app", () => {
  const hits = walk("src").filter((p) => {
    const s = readFileSync(p, "utf8");
    return ["Log Property Activity", "Create Ops Ticket", "Create Maintenance Ticket", "Create linked Ops Ticket", "Open Ops Ticket"].some((t) => s.includes(t));
  });
  expect(hits).toEqual([]);
});
