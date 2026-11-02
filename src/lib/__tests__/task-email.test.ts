import { describe, expect, it, beforeEach } from "bun:test";
import { readFileSync } from "node:fs";
import {
  NO_HOMEOWNER_EMAIL,
  TASK_MERGE_KEYS,
  checkedCc,
  firstName,
  splitHomeowners,
  suggestTemplateId,
  taskEmailEventSummary,
} from "@/lib/task-email";
import { applyMergeFields } from "@/lib/email-composer";
import { localEmailBlock } from "@/lib/email-safety.server";

const contacts = [
  { name: "Ryan Lee", email: "ryan@home.com" },
  { name: "Lindsey Lee", email: "lindsey@home.com" },
  { name: "Ryan dup", email: "RYAN@home.com" },
];

describe("Email homeowner from a Task", () => {
  it("prefills the main homeowner and offers co-owners as CC", () => {
    const s = splitHomeowners(contacts);
    expect(s.primary?.email).toBe("ryan@home.com");
    expect(s.coOwners.map((c) => c.email)).toEqual(["lindsey@home.com"]);
  });

  it("CC is empty until a box is checked", () => {
    const { coOwners } = splitHomeowners(contacts);
    expect(checkedCc(coOwners, {})).toEqual([]);
    expect(checkedCc(coOwners, { "lindsey@home.com": true })).toEqual(["lindsey@home.com"]);
  });

  it("no homeowner email gives no primary and a clear message", () => {
    expect(splitHomeowners([]).primary).toBeNull();
    expect(NO_HOMEOWNER_EMAIL).toMatch(/no homeowner email/);
  });

  it("suggests a template linked by the Task name only when unique", () => {
    const t = [
      { id: "a", name: "Welcome call", contexts: ["onboarding_task"] },
      { id: "b", name: "Utility setup", contexts: ["onboarding_task"] },
      { id: "c", name: "Utility setup", contexts: ["ticket"] },
    ];
    expect(suggestTemplateId(t, "Utility Setup")).toBe("b");
    expect(suggestTemplateId(t, "Schedule the welcome call with owner")).toBe("a");
    expect(suggestTemplateId(t, "Something else")).toBeNull();
  });

  it("merges home, first name and ARHA contact", () => {
    const out = applyMergeFields("Hi {{owner_first_name}}, about {{property}}. {{arha_contact}}", {
      owner_first_name: firstName("Ryan Lee"),
      property: "123 Main St",
      arha_contact: "Kati Hand, A Real Home Away",
    });
    expect(out).toBe("Hi Ryan, about 123 Main St. Kati Hand, A Real Home Away");
  });

  it("merge keys never include codes, guests or internal notes", () => {
    for (const k of TASK_MERGE_KEYS) expect(k).not.toMatch(/code|guest|note|detail|lock|wifi/);
    const server = readFileSync("src/lib/email-composer.server.ts", "utf8");
    const block = server.slice(server.indexOf('context === "onboarding_task"'), server.indexOf('context === "work_order"'));
    expect(block).not.toMatch(/detail:|task\["detail"\]\s*[,}]/);
  });

  it("event summary wording", () => {
    expect(taskEmailEventSummary(" Your utilities ")).toBe("Emailed homeowner: Your utilities");
  });

  it("demo records never send", () => {
    expect(localEmailBlock({ to: "ryan@home.com", isDemo: true })).toMatch(/Demo/);
  });
});

describe("recordTaskEmailEvents", () => {
  const inserts: { table: string; row: Record<string, unknown> }[] = [];
  beforeEach(() => inserts.splice(0));
  const client = {
    from(table: string) {
      const q = {
        select: () => q, eq: () => q, order: () => q, limit: () => q,
        maybeSingle: async () => ({ data: { id: "proj-1" } }),
        insert: async (row: Record<string, unknown>) => { inserts.push({ table, row }); return { error: null }; },
      };
      return q;
    },
  };
  it("logs on the Task's project and the home's history, keeping demo flag", async () => {
    const { recordTaskEmailEvents } = await import("@/lib/task-email.server");
    await recordTaskEmailEvents(client as never, {
      taskId: "t1", propertyId: "p1", isDemo: true, subject: "Utilities", actor: "u1",
    });
    expect(inserts.map((i) => i.table)).toEqual(["onboarding_project_events", "property_activity_log"]);
    expect(inserts[0]!.row).toMatchObject({ kind: "homeowner_emailed", summary: "Emailed homeowner: Utilities", new_value: "t1", is_demo: true });
    expect(inserts[1]!.row).toMatchObject({ category: "administrative", is_demo: true });
  });
});

describe("drawer visibility", () => {
  it("Email homeowner shows only when the person can work the Task", () => {
    const src = readFileSync("src/components/onboarding/TaskDrawer.tsx", "utf8");
    expect(src).toMatch(/\{!disabled && \([\s\S]{0,200}label="Email homeowner"/);
  });
  it("send records events only after a real send, never for scheduled or blocked", () => {
    const src = readFileSync("src/lib/email-composer.functions.ts", "utf8");
    expect(src).toMatch(/taskRow && result\.status === "sent"/);
    expect(src).toMatch(/taskRow\?\.is_demo \? \{ isDemo: true \}/);
  });
});
