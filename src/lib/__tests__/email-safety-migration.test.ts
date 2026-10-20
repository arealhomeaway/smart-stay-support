import { expect, it } from "bun:test";
import { readFileSync } from "node:fs";

const sql = readFileSync(new URL("../../../docs/pending/email-job-release/0152_email_delivery_safety.sql", import.meta.url), "utf8");
const mappings = new Map(Array.from(sql.matchAll(/WHEN '([^']+)' THEN '([^']+)'/g), ([, entity, table]) => [entity, table]));

it("maps Handoff staff notification sources to their canonical records", () => {
  expect(mappings.get("handoff")).toBe("handoffs");
});

it("maps every concrete entity supplied directly by the shared sender's current callers", () => {
  const required = {
    owner_notification: "owner_notifications",
    staff_notification: "staff_notifications",
    owner_program: "owner_programs",
    help_ticket: "help_tickets",
    ticket: "tickets",
    work_order: "work_orders",
    property: "properties",
    onboarding_task: "onboarding_tasks",
  };
  for (const [entity, table] of Object.entries(required)) expect(mappings.get(entity)).toBe(table);
});