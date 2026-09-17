# Local onboarding acceptance fixtures

Start from the repository root:

```sh
node node_modules/vite/bin/vite.js --config qa/onboarding/vite.config.ts
```

Open `http://127.0.0.1:5174/qa/onboarding/index.html`.

This isolated renderer uses the production WorkflowTable, scope engine, lifecycle
and release rules. It loads no application server, authentication or Supabase
client. Both synthetic properties, projects and all tasks carry `is_demo: true`;
the standard reporting filter excludes them. Each fixture contains all 180 current
template tasks/subtasks before applicability is applied. No real documents,
owner contacts, credentials, entry codes or message delivery are used.

The canonical fixture factory is `src/lib/onboarding-qa-fixtures.ts`. Preserve
it, its automated tests, the renderer and this configuration as active acceptance
assets. Do not treat them as disposable build output.

## Repeatable checks

- Full Furnishing: 172 applicable tasks, 8 excluded under its selected modules.
- No Furnishings: 147 applicable tasks, 33 excluded; child tasks inherit exclusions.
- Before closing: post-closing work remains unreleased.
- Active onboarding: applicable open work is displayed with authoritative release
  states. Future sections remain collapsed until expanded.
- Director review: completed work is read-only history in the review scenario.
- Awaiting Supervisor Live: acceptance is recorded, but the lifecycle remains
  pending Live and the final handoff step remains upcoming.
- Live and locked: the lifecycle is Live and the plan is locked.
- Select a task, expand a future section and inspect Not Applicable reasons.

## Verification recorded September 14, 2026

Desktop screenshot inspected at the browser's default size. Both scope cases
inspected at a 390 × 844 viewport override; controls and workflow rows remained
within the viewport. No Furnishings pending-Live DOM measurement reported content
width equal to available client width (375 px excluding the scrollbar).
The pending-Live rail correctly showed Supervisor Live current and completion
upcoming. Temporary browser size override was reset afterwards.

This is workflow/component acceptance evidence only. It does not prove database
writes, permissions, financial delivery, stage-capture forms, the authenticated
property workspace or the full Active Owner portal. Those remain separately
required. The QA projects have not been seeded into any live database.
