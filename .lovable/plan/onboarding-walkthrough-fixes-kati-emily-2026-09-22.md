# Onboarding walkthrough fixes — Kati & Emily

Everything from both rounds of walkthrough feedback, in the order it should be built. Two decisions need your answer before I start the items marked **Decision**.

## A. Make every work activity workable

Today a step can read "waiting on…" or "released after possession" and the Finish button is switched off. That goes away: every step is workable and completable from day one, and the ordering hints disappear from the cards entirely. The underlying prerequisite data stays in the record (so reporting and the template still know the intended order), it just never blocks or labels a PM.

Overdue stays honest: a step is late against its own due date, nothing else.

## B. Dates on the home dashboard

The top of an onboarding home gets an editable date row — Closing, Access (possession), Target handoff — each editable in place, with the change recorded in History.

Target handoff fills itself in from the access date: **3 weeks** for a standard home, **4 weeks** for an Active Owner home. It keeps following the access date if that moves, and stops the moment someone types their own handoff date (shown as "set by hand").

## C. Deadlines that mirror Asana

Every task's due date is calculated from the possession/access date using the same offsets as your Asana onboarding template. I'll connect Asana, read the template, and map each Resolve step to its Asana counterpart and day offset. Steps with no match are listed for you and Kati to confirm rather than guessed.

Changing the access date re-dates the whole plan, except tasks with a hand-set date.

## D. Project managers

Iveth (iveth@arealhomeaway.com) and Sofia Alvarez (sofia.alvarez@arealhomeaway.com) get Resolve accounts with the onboarding role so they appear in the project manager list, and the list itself is limited to people who can actually hold onboarding work — no more irrelevant names.

## E. Enrolling a home — one click, owner included

- Choosing a home in the import list starts enrollment straight away. The extra "Review" step and second confirmation are gone.
- Owner details come from OwnerRez automatically (name, email, phone from the property's owner record). If OwnerRez has nothing, you fill in the owner right there and Resolve creates the owner record — which is what makes the Active Owner button usable at that moment.
- Confirming with "Start onboarding" creates the project and the task plan immediately; nothing to click again on the next page.

## F. The start-onboarding questions, reorganised

Reworked into the way Kati actually assesses a home, and every answer stays editable afterwards from the home's Property tab:

- Appliances: New / Existing / Both
- Furnishing: Full furnishing / Owner furnished / Existing home (no furnishing)
- Pool or hot tub: None / Neighborhood / At the property
- Security: smart lock recorded explicitly, alongside cameras
- The rest (utilities, repairs, HOA, landscaping, warranty, Active Owner) stays as-is

## G. The work surface

- **Assignee** becomes a real person picker with photo, on the list rows and inside the task.
- **Tabs move below the dashboard**, so the home's headline information — photo, address, closing and access dates, PM — reads first.
- **Status bar** across the dashboard filling from completed work, with a **Notes** button beside it that opens every note written on any task for that home, newest first.
- **"This home's work"** duplicate block is removed.
- Opening a work activity gives a **centred pop-up** instead of the side drawer: what this step is, its dates and assignee, the fields that belong to *this* step, then attachments, then finish, then "Send to homeowner" at the bottom.
- **Task-specific content**: a document step (Store HOA documents) shows an upload area and nothing about Breezeway; a vendor step shows dispatch; a homeowner step shows the question and files. Breezeway export appears only on steps that dispatch work. Every step gets a plain drag-and-drop upload area.

## H. Vendor work tracking inside onboarding

A Work orders section on the onboarding home showing both kinds side by side: ones pushed to Breezeway (with their Breezeway status coming back) and ones for vendors not in Breezeway (tracked in Resolve with assigned vendor, dates, cost and completion evidence). Same list, one column telling you which is which, so nothing lives only in someone's head.

## Decisions I need from you

1. **Handoff gates.** You asked to remove them. The four-gate approval is what records Kati's and Micah's sign-off and what stops a home entering Operations unaccepted — removing it entirely also removes that record. My recommendation: remove the separate Handoff tab and its checklist, and keep a single "Ready for Operations / Accepted" action on the dashboard so acceptance is still recorded by name and date. Tell me if you want it gone completely instead.
2. **Asana access.** I'll need the Asana connection approved to read the onboarding template. If you'd rather paste the step list and day offsets, that works too.

## Technical notes

- Task gating: `releaseState` in `onboarding-state.ts` stops returning `future`/`waiting`; `viewTask` keeps only real statuses (complete, in progress, ready, correction). Existing gate tests get rewritten to assert workability.
- Dates: `onboarding_projects.planned_closing_on / possession_on / target_handoff_on` plus a new `target_handoff_source` ('auto' | 'manual') column; `dueFor()` in `onboarding-template.server.ts` already anchors on access, so the Asana offsets load into the template table rather than into components.
- Enrollment: `property-intake.server.ts` gains an OwnerRez owner fetch (`/properties/{id}` → `owner_id` → `/owners/{id}`) and starts the project in the same server call as the import.
- Scope: `onboarding-scope.ts` gains `appliance_scope`, `pool_location`, and keeps furnishing as a three-value enum; migration is additive with a backfill from today's module flags.
- Work orders: reuse `work_orders` with an onboarding project link and the existing `breezeway_outbound_tasks` join for the pushed/not-pushed column.
- Tests: update the workflow/release suites, add coverage for handoff auto-dating, OwnerRez owner import and the new scope fields.
