# Active Owner: the plan starts at enrollment (Nov 12), STAGED, NOT APPLIED

Approved by the Admin, Nov 12. Register O5: owners may log hours before closing; opportunities open at enrollment with no staff gate.
Apply only with the Admin's go. Nothing here has been run on the real database.

| Order | File | What it does | Undo |
| --- | --- | --- | --- |
| 1 | `apply.sql` | One rule `private.owner_program_live`: draft, waiting_for_closing, ready_for_onboarding, active, target_reached are live; paused, closed, completed, archived (and the old pending) are not. Ten live functions use it instead of `status = 'active'` (list below). The program trigger also fires when the homeowner login is linked, so a plan that started before the login gets its one plan-ready notice then. | `apply.undo.sql` |
| check | `practice.sql` | Practice on the real database inside BEGIN … ROLLBACK, with a practice owner and two practice homes made inside the transaction. Run by whoever applies, before applying. | nothing kept |

`live-capture/` holds the exact live text of every engine function read on Nov 12 (used by the undo and by the test copy).

## Functions changed (only the status check, unless noted)
| Function | Before | After | Why |
| --- | --- | --- | --- |
| private.ao_enrollment_changed (home branch) | starts the plan only if the program is `active` | any live status | plan starts at enrollment |
| private.ao_enrollment_changed (program branch) | starts plans when status becomes `active` | when status becomes live from not live (not from closed); plus the one plan-ready notice when the homeowner login is linked | same; the login is linked just after the program is created |
| trigger ao_program_changed | status, archived_at | status, archived_at, owner_user_id | runs the notice step above |
| private.ao_home_program | `active` only | live | the home's program for every card, Send to the homeowner and the handoff step |
| private.ao_enrolled_rows | `active` only | live | Start plans for enrolled homes |
| private.lock_owner_time_program | owner new hours: draft/active/target_reached; staff without a started clock: draft only | live (edits: live or paused) ; staff: draft, waiting_for_closing, ready_for_onboarding | Log hours |
| public.owner_hours_eligibility | draft/active/target_reached | live | Log hours button |
| public.capture_owner_time_update | active/target_reached | live | hours logged from a reviewed update |
| public.can_view_owner_library_video | `active` | live | Opportunity videos |
| public.notify_owner_of_review | pending/active | pending or live | owner item notices |
| public.record_owner_work_order_response | pending/active | pending or live | owner answers a Work Order request |
| public.owner_release_summary | pending/active/target_reached | pending or live | owner summary of opened Opportunities |

`pending` is kept where it was already allowed (legacy value, no live program has it today), so nothing that worked stops working.

## Checked and left unchanged
- `activate_owner_program`: unchanged. Activate still needs a closing date and sets the clock (started_on, ends_on). DFY and closing rules stay.
- `active_owner_enrollment_step`: unchanged. Its onboarding and operating steps still create Opportunities from the older templates (see the reply).
- `create_owner_matter`: unchanged. Owners open property work only for homes after closing.
- `notify_owner_of_ticket`, `owner-ticket-alert.server.ts`: Ticket alerts, not owner plan work.
- `private.ao_label_sync`: the Active Owner home label stays on active programs only (display only, gates nothing).
- `private.schedule_after_handoff`, `after_handoff_schedule_add_one_off`, `after-handoff.functions.ts`: they use owner_task_templates; project rule says leave that code unless a request names it.
- `release_owner_program_activities`: unchanged; the app action that called it now refuses.
- `redeem_owner_invite`: already allows every live status.
- `change_owner_program`, `complete_owner_program`: lifecycle rules, unchanged.
- Owner portal reads (`read_owner_programs`, `read_owner_program_properties`, `read_owner_participation`, `owner_program_readable`): no status gate.

## Before applying
- No program is in draft, waiting_for_closing or ready_for_onboarding today (Nov 12: 5 real and 1 demo program, all active). A draft created before this file is applied would get its plan from Start plans for enrolled homes.
- Applying needs rights on the `private` schema; this sandbox's database role has none, so the practice was refused there with nothing kept.

## Proof
`src/lib/__tests__/ao-enrollment-start.test.ts` builds an isolated PostgreSQL copy from the live table shapes and `live-capture/`, shows that live today a draft program gets no cards, then applies `apply.sql`: creating a draft program builds the home's cards, linking the login adds exactly one plan-ready notice, a second home added later also starts and folds into the same notice, the owner of a draft program reads the cards and may log hours, paused and closed start nothing, and the undo puts back the exact live text.
