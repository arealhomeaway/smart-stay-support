# Resolve Onboarding + Active Owner — Long-Running Build Goal

## Outcome

Build a preview-ready, production-safe Onboarding operating system and integrated Active Owner experience for A Real Home Away in this repository. Continue through implementation, tests, commits, and a draft PR without waiting for routine approvals. Stop only for a genuine business-policy conflict, credentials/login, destructive external write, production migration, deployment, or merge approval.

## Starting point

- Repository: `arealhomeaway/smart-stay-support`
- Working branch: `codex/onboarding-active-owner-build`
- Branch base: `main@e813389933db830d5897eba5c7d85c603ea8f7e6`
- Do not rewrite pushed history.
- Read and follow `AGENTS.md`.
- Preserve the current Operations architecture merged through PR #7.

## Existing requirements are already approved

Do not restart business discovery. Treat prior project decisions, repository plans, current Asana onboarding workflows, historical/current Notion material, and prior Fillout/Make/Supabase audits as the source set. Clearly distinguish current policy from historical behavior, but do not ask Emily to repeat information already documented.

Read these plans first:

1. `.lovable/plan/onboarding-operating-system-staged-build-2026-09-03.md`
2. `.lovable/plan/onboarding-portal-asana-familiarity-resolve-automation-2026-09-01.md`
3. `.lovable/plan/90-day-owner-participation-program-multi-property-upgrade-2026-08-21.md`
4. `.lovable/plan/resolve-beta-revised-sequence-under-emily-s-approved-directi-2026-08-28.md`

Also inspect relevant existing onboarding, owner participation, Property Hub, approvals, evidence, documents, handoff, tickets, Work Orders, auth/RLS, fixtures, and migrations before editing.

## Product rules

- Resolve replaces fragmented task handling; it should not recreate Asana, Notion, Fillout, or Make screen-for-screen.
- Optimize for simple daily use, clear ownership, progressive disclosure, reliable handoffs, and auditability.
- Go-live order remains Operations, Onboarding, Active Owner, Vendor.
- Property, Owner, Onboarding Project, portal access, and Active Owner enrollment are distinct concepts.
- Active Owner enrollment is property/program-level; one owner portal may aggregate enrolled properties while excluding non-enrolled properties.
- Active Owner is a guided 90-day program with at least 100 documented hours; hours start post-closing. It is not presented as a second job and does not guarantee tax treatment.
- Use the established two-review onboarding gate before Operations live confirmation: onboarding review, Operations review, Operations acceptance, then Supervisor Live.
- ARHA onboarding scope is guest readiness. Long-term property-health inspection responsibility is outside scope.
- Existing workflows may be improved; their existence is not proof they are correct.
- Use job titles/roles in product rules rather than hard-coded employee names.

## Implementation sequence

### Pass 1 — Foundation

- Separate Property, Owner, Onboarding Project, portal access, and enrollment.
- Add an explicit Start Onboarding flow using known property/owner context.
- Capture responsible roles, closing/possession/target handoff dates, scope/modules, and external references.
- Implement applicability rules for furnishing, pool, HOA, utilities, repairs, appliances, smart lock, cameras, warranty, and Active Owner.
- Support Full Furnishing and No Furnishings through one rules engine.
- Surface owner contact in property, project, approval, and handoff contexts.
- Extend existing onboarding lifecycle/workflow logic instead of replacing it.

### Pass 2 — Work, evidence, and facts

- Support Future, Waiting, Ready, In Progress, Awaiting Review, Correction Required, Complete, and Not Applicable behavior.
- Release work from prerequisites, lifecycle, and applicability; keep future work visually quiet.
- Use native stage capture with revision history.
- Attach evidence metadata while keeping approved file-system boundaries.
- Make observations and permanent-fact proposals reviewable before canonical property/asset data changes.
- Preserve prior values and reviewer history; never silently overwrite.
- Model corrections as traceable work.
- Enforce gate-driven stage completion and controlled reopening.

### Pass 3 — Owners, financials, and handoff

- Use one canonical Owner Approval model with standard-owner email and Active Owner in-app channels.
- Link approvals to property, task/ticket, evidence, request, response, and staff-confirmed decision.
- Normalize utilities and financial requests.
- Preserve estimate, approved amount, invoice, actual, variance, and accounting handoff separately.
- Use configurable policy thresholds; do not invent unresolved authority rules.
- Implement the locked handoff chain and keep financial reconciliation separate from Live readiness.

### Pass 4 — Usability and QA

- Manager Hub, My Work, and per-property workspace.
- Stable property workspace areas: Overview, Work, Property, Financial, Handoff, History.
- Role-specific views for Project Manager, Onboarding Director, Operations Director, Operations Supervisor, and field staff.
- Director attention queues must drill into the filtered work.
- Preserve navigation origin, filters, and contextual Back behavior.
- Add two clearly marked, KPI-excluded QA projects: Full Furnishing and No Furnishings.
- Desktop and 390px mobile verification.

## Reuse before rebuilding

Reuse and extend existing modules where applicable, including:

- `src/lib/onboarding.ts`
- `src/lib/onboarding-template.ts`
- `src/lib/onboarding-schedule.server.ts`
- `src/lib/onboarding.server.ts`
- `src/lib/onboarding.functions.ts`
- `src/lib/onboarding-ownership.ts`
- evidence modules
- handoff panels
- operations context
- external records
- onboarding notes/template panels
- owner participation/program modules
- current semantic design system

Do not create parallel competing implementations when an existing canonical model can be extended safely.

## Safety boundaries

Allowed without further approval:

- Branch-local code and documentation edits
- Additive migration files that are not applied
- Automated tests and safe local fixtures
- Local builds, linting, type checks, and static review
- Commits to this branch
- A draft pull request
- Fixing issues found during branch-local testing

Not authorized:

- Merge to `main`
- Production deployment or publication
- Applying migrations to any live database
- Modifying live or real-user data
- Activating Make or other paused automations
- Sending owner, guest, vendor, or staff messages
- External writes to SharePoint, Breezeway, OwnerRez, Telegram, or email
- Changing permissions, auth, secrets, or access policies
- Force-push, rebase, amend, squash, or rewrite published history

## Verification and definition of done

For each pass:

- Add meaningful focused tests.
- Run available unit tests, lint, typecheck, and build.
- Separate pre-existing failures from regressions with evidence.
- Verify no unintended Operations regression.
- Review schema changes for grants and RLS.
- Verify desktop and 390px behavior where browser preview is available.
- Commit a working state with a clear message.
- Update the draft PR with exact scope, migrations, tests, known limitations, and acceptance steps.

The goal is complete when all four passes are implemented on the isolated branch, automated checks are documented, the Lovable preview is ready for safe acceptance testing, and Emily receives one consolidated review request. Do not merge or deploy.
