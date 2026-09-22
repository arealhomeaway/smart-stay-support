# Editable onboarding templates and project editing

## Why

Today the onboarding plan (the 26-step master sequence, its stages, roles, deadline offsets and subtasks) lives in code. The onboarding director can work a project but cannot change the plan itself, and cannot create a second plan for a different kind of home. Everything below keeps the existing plan working exactly as it does now, and adds an editable layer on top.

## What the director gets

1. **A Templates page** (Onboarding > Templates), visible to the onboarding director and platform owners only.
   - Lists the built-in ARHA plan plus any templates the team has created.
   - "Duplicate and edit" turns the built-in plan into an editable copy (steps, stages, roles, timing, subtasks copied over).
   - "New template" starts an empty plan.
   - One template can be marked the default used when a new home starts onboarding.
2. **Template editing**: add, rename, reorder, and remove steps; set each step's stage, responsible role, instructions, subtasks, whether it needs homeowner approval, whether it blocks handoff, whether evidence is required, and its deadline offset (days from possession/access).
3. **Applying a template to a home**: the existing preview-and-confirm flow gains a template picker, so a director can apply any template. Duplicate protection stays: a step already on the home is skipped, never doubled.
4. **Editing a live project**: the current scope panel, key dates, stage, task and milestone editing stay as they are; the director additionally gets
   - add/edit/remove steps on a live project (already allowed for directors, not PMs — unchanged),
   - "Recalculate deadlines" on the project, which re-paces every unfinished step from the current access date using the template's offsets, with a preview of what changes before it is saved.

## Technical notes

**Database** (one migration, with GRANTs and RLS in the same migration):
- `onboarding_templates` — id, key, name, description, is_default, is_archived, created_by, timestamps.
- `onboarding_template_tasks` — template_id, stage, title, role, detail, sort_order, blocks_handoff, requires_owner_approval, owner_approval_when_active_owner, evidence_required, schedule_anchor, offset_days, breezeway_template_id, subtasks (text[]).
- RLS: SELECT for internal staff (`is_onboarding_staff`), INSERT/UPDATE/DELETE gated on `is_supervisor`. GRANT SELECT/INSERT/UPDATE/DELETE to `authenticated`, ALL to `service_role`, no `anon`.

**Code**
- `src/lib/onboarding-template-catalog.ts` — pure shaping: normalise a DB template row set into the existing `TemplateTask[]` shape so downstream code is unchanged.
- `src/lib/onboarding-template-admin.server.ts` — list/create/duplicate-builtin/update/delete/set-default, each supervisor-gated and audited (`onboarding_template_created`, `_updated`, `_deleted`, `_default_set`).
- `src/lib/onboarding-template-admin.functions.ts` — server fns behind `requireSupabaseAuth`.
- `onboarding-template.server.ts` — `previewOnboardingTemplate` / `applyOnboardingTemplate` take an optional `templateId`; with none they resolve the default DB template, falling back to the built-in constant. Dedupe, seat assignment, owner-approval preparation and access-date pacing are untouched.
- New capability `onboarding_templates` in `src/lib/permissions.ts`, added to `SUPERVISOR_CAPS` (so admin and manager, which is the director's role).
- `src/routes/_authenticated/onboarding.templates.tsx` plus `src/components/onboarding/TemplateEditor.tsx` — list, editor table, step dialog; matches the Operations Hub visual language.
- Recalculate deadlines: reuse `onboarding-schedule.ts` offsets in a new `recalculateProjectDeadlines` (preview + apply) in `onboarding-schedule.server.ts`, skipping completed and manually overridden steps.

**Tests**: unit coverage for catalog normalisation, template CRUD gating (PM denied, director allowed), apply-with-custom-template dedupe, and deadline recalculation pacing. Full suite must stay green.
