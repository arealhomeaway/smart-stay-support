const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

function loadTypeScript(file, dependencies) {
  const source = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  new Function("module", "exports", "require", js)(module, module.exports, (name) => {
    if (!(name in dependencies)) throw new Error(`Unexpected test dependency: ${name}`);
    return dependencies[name];
  });
  return module.exports;
}

const priorities = ["p1", "p2", "p3"].map((value) => ({ value }));
const { priorityCorrection } = loadTypeScript("src/lib/ticket-priority.ts", {
  "@/lib/tickets": { PRIORITIES: priorities },
});

assert.deepEqual(priorityCorrection("p2", "p2", "p1", "Active safety issue"), {
  priority: "p1",
  reason: "Active safety issue",
  activity: "Priority corrected from P2 to P1 (calculated P2). Reason: Active safety issue",
});
assert.throws(() => priorityCorrection("p3", "p3", "p4", "Any reason at all"), /P1, P2 or P3/);
assert.throws(() => priorityCorrection("p3", "p3", "p2", "short"), /at least 10/);
assert.throws(() => priorityCorrection("p3", "p3", "p3", "Any reason at all"), /different/);

let handler;
const createServerFn = () => ({
  middleware() { return this; },
  inputValidator() { return this; },
  handler(fn) { handler = fn; return fn; },
});
loadTypeScript("src/lib/ticket-priority.functions.ts", {
  "@tanstack/react-start": { createServerFn },
  "@/integrations/supabase/auth-middleware": { requireSupabaseAuth: {} },
  "@/lib/ticket-priority": { priorityCorrection },
  "@/lib/tickets": {
    slaDueDates: () => ({ response_due_at: "response-deadline", action_due_at: "action-deadline" }),
  },
});

function fixture(role) {
  const calls = [];
  const ticket = {
    id: "ticket-id", priority: "p2", suggested_priority: "p2",
    reported_at: "2026-09-18T00:00:00Z", updated_at: "2026-09-18T01:00:00Z",
    is_demo: false, work_type_id: null, acknowledged_at: null, action_started_at: null,
  };
  const table = (name) => ({
    select() { return this; },
    eq() { return this; },
    update(value) { calls.push({ name, operation: "update", value }); return this; },
    insert(value) { calls.push({ name, operation: "insert", value }); return Promise.resolve({ error: null }); },
    maybeSingle() {
      return Promise.resolve({ data: name === "tickets" ? (calls.some((c) => c.operation === "update") ? { id: ticket.id } : ticket) : null, error: null });
    },
    then(resolve) { return Promise.resolve({ data: [{ role }], error: null }).then(resolve); },
  });
  return { calls, context: { userId: "actor-id", supabase: { from: table } } };
}

(async () => {
  const data = { ticketId: "ticket-id", priority: "p1", reason: "Active safety issue", isDemo: false };
  const coordinator = fixture("tech");
  await assert.rejects(handler({ data, context: coordinator.context }), /Only an Operations supervisor/);
  assert.equal(coordinator.calls.length, 0);

  const supervisor = fixture("manager");
  await handler({ data, context: supervisor.context });
  const update = supervisor.calls.find((call) => call.operation === "update");
  const activity = supervisor.calls.find((call) => call.operation === "insert");
  assert.equal(update.value.priority, "p1");
  assert.equal(update.value.priority_override_reason, "Active safety issue");
  assert.equal(update.value.response_due_at, "response-deadline");
  assert.equal(activity.value.author_id, "actor-id");
  assert.match(activity.value.body, /calculated P2/);
  console.log("Ticket priority: 6 checks passed (calculation guard, coordinator denial, supervisor audit path).");
})().catch((error) => { console.error(error); process.exitCode = 1; });
