import { describe, expect, it } from "bun:test";
import { emailRecipient, localParts, reminderDue, reminderEmailHtml, reminderLines, testInbox } from "../onboarding-daily-reminder";

const PM = "pm-1";
const projects = new Map([["home-1", { project_manager: PM, role_assignments: { designer: "des-1" } }]]);
const base = { property_id: "home-1", status: "open", assigned_to: null as string | null, assigned_seat: null as string | null };

describe("onboarding 8 AM reminder", () => {
  it("is due only during 8 AM in the person's own time zone", () => {
    const at = new Date("2026-11-23T14:30:00Z"); // 8:30 AM Central, 9:30 AM Eastern
    expect(reminderDue(at, "America/Chicago")).toBe(true);
    expect(reminderDue(at, "America/New_York")).toBe(false);
    expect(reminderDue(new Date("2026-11-23T13:30:00Z"), "America/New_York")).toBe(true);
  });

  it("uses Central when the time zone is missing or unknown", () => {
    const at = new Date("2026-11-23T14:30:00Z");
    expect(localParts(at, null).timeZone).toBe("America/Chicago");
    expect(reminderDue(at, "Not/AZone")).toBe(true);
  });

  it("lists only the person's overdue and due-today open Tasks", () => {
    const lines = reminderLines({
      userId: PM,
      localDay: "2026-11-23",
      projects,
      homeName: () => "1 Main St",
      tasks: [
        { ...base, id: "late", title: "Late", due_on: "2026-11-20" },
        { ...base, id: "today", title: "Today", due_on: "2026-11-23" },
        { ...base, id: "tomorrow", title: "Tomorrow", due_on: "2026-11-24" },
        { ...base, id: "done", title: "Done", due_on: "2026-11-20", status: "complete" },
        { ...base, id: "designer", title: "Designer's", due_on: "2026-11-20", assigned_seat: "designer" },
        { ...base, id: "someone", title: "Someone else's", due_on: "2026-11-20", assigned_to: "other" },
      ],
    });
    expect(lines.map((l) => [l.id, l.overdue])).toEqual([["late", true], ["today", false]]);
    expect(lines[0]!.link).toBe("/onboarding/home-1?tab=tasks&task=late");
  });

  it("links every Task in the email", () => {
    const html = reminderEmailHtml(
      [{ id: "a", title: "A", home: "1 Main", dueOn: "2026-11-20", overdue: true, link: "/onboarding/h?tab=tasks&task=a" }],
      "https://x.test",
    );
    expect(html).toContain('href="https://x.test/onboarding/h?tab=tasks&amp;task=a"');
  });

  it("sends every onboarding email only to the test inbox while it is set", () => {
    const inbox = testInbox({ email: "emily.jimenez@arealhomeaway.com" });
    expect(emailRecipient("pm@arealhomeaway.com", inbox)).toBe("emily.jimenez@arealhomeaway.com");
    expect(emailRecipient("pm@arealhomeaway.com", testInbox({ email: "" }))).toBe("pm@arealhomeaway.com");
    expect(testInbox(null)).toBeNull();
  });
});
