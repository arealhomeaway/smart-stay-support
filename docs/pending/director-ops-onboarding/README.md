# director-ops-onboarding
Gives the Director of Operations every permission the Director of Onboarding has.
- `is_onboarding_director` (used by every onboarding page, RLS rule and server check) also answers yes for the Director of Operations role holder.
- `perform_handoff_step`: the Director of Operations may also mark a home ready.
- Notices, reminders and escalations sent to the Director of Onboarding are unchanged (same recipients).
- No rows change. Undo: `apply.undo.sql`. Apply only on "Approved: apply director-ops-onboarding".
