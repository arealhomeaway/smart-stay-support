# Make the full Asana-derived plan the default for new homes

Scope: new homes only. Fitzgerald, Maple Manor, Foxtail and Buckland are not touched. They keep their own restored steps and history.

## What I found

- New homes start from whichever plan is marked **default**, using its latest **published version**. Today that is "ARHA Onboarding V2" (15 steps, version 1).
- The four restored homes all hold the same detailed plan: 146 Asana-derived steps in 7 stages. Every home got the same copy.
- The Template Builder can already add, rename, delete, reorder and move steps between stages. It can also edit checklist items and blocking, and publish a plan or set it as the default.
- **There are 4 gaps that would stop Kati from using it the way you described:**
  1. **Checklist items are dropped.** When a new home starts, its steps are created but their checklist items are not.
  2. **Role routing can't be edited.** The Builder saves a free-text role label. New homes route by a separate field (Primary PM, Utilities, Design & Staging, Director, Operations roles) that the Builder doesn't show.
  3. **Required/optional and disable** exist on each step, but the Builder doesn't show or save them.
  4. **Homeowner Business Decisions** (the management agreement and the cost projections) don't carry over to a new home as "Business decision". New homes would lose that gate.

## Proposed changes (after your approval)

1. **Build a new plan "ARHA Onboarding — Full Plan"** in the Template Builder. Take it from the restored steps on Fitzgerald: 146 steps with their checklist items, stages, roles, blocking flags and order.
   - Excluded: the 21 numbered V2 draft steps, "Obtain owner decisions and approvals", the local area guide, archived owner-activity copies and all Opportunities.
   - The 15 short V2 steps are also excluded, because the detailed steps already cover them. See decision 1.
2. **Leave "ARHA Onboarding V2" as it is.** Published versions never change. It just stops being the default, and homes already started on it keep their version.
3. **Fix the 4 gaps:**
   - Starting a home creates its checklist items.
   - The Builder gets a role picker using the Project Team roles, plus Required/Optional and Active/Disabled switches.
   - "Business decision" and the other homeowner-dependency types can be set per step and carry over to new homes.
4. **Publish version 1** of the new plan and make it the default. From then on, Kati edits it and publishes new versions when she's ready. Each home keeps the version it started on.
5. **Check it in the app as Kati** on a demo home only:
   - Start a demo home and confirm about 146 Tasks and all checklist items appear.
   - Confirm roles route to the Project Team, and a role change reassigns open Tasks.
   - Confirm the two-step handoff and the Operations Live confirmation work unchanged.
   - Confirm no homeowner sees anything.

## Decisions for you

1. **The 15 short V2 steps:** leave them out (recommended, since the detailed steps cover them), or keep them as extra steps?
2. **Stage names:** use the 7 detailed stages (Documents & Assessment, Scope/Utilities & Compliance, Design/Approvals & Procurement, Fieldwork/Setup & Review, Listing & Final Clean, Handoff & Acceptance, Closeout & Stabilization)? Kati can rename them later.
3. **Roles:** keep each step's role exactly as it is on Fitzgerald today? Almost everything is on the Primary PM, and utilities and design steps aren't on those roles yet. Kati can change any step afterwards.
4. **Final step count:** Fitzgerald has 5 "Update project status" steps and a few other obvious repeats. Keep them all as-is (146), in line with "no consolidation now"?

## Technical details

- New `onboarding_templates` row plus `onboarding_template_stages` (7) and `onboarding_template_tasks` (146), seeded by a migration from the canonical Fitzgerald rows. Excluded by title pattern `^\d+\. ` plus the named exclusions. `functional_role` comes from `assigned_seat`, and `subtasks[]` from the child task titles.
- Migration that updates `instantiate_onboarding_v2`:
  - Insert child `onboarding_tasks` from `step->'subtasks'` (with `parent_task_id`).
  - Copy `owner_dependency`, and add `owner_dependency` to `onboarding_template_tasks`.
  - Honour `is_active` (publish already filters it).
- `saveTemplateStep` and the Builder UI persist `functional_role`, `is_required`, `is_active` and `owner_dependency`.
- Publish through the existing `publish_onboarding_template`, then use `setDefaultOnboardingTemplate`.
- Tests: instantiation creates subtasks, carries over the role and the Business Decision, and skips disabled steps. Existing tests stay green.
