# add_upcoming_onboarding_home: onboarding team and Admin only

Not applied. Apply only after "Approved: apply add-upcoming-access-fix".

Read live Nov 13: the function lets in `onboarding_home_lead` (Admin or Director of Onboarding) or
`is_onboarding_staff`, which counts the admin, manager and onboarding account types. Manager is the
Operations account type, so the Operations Supervisor and the Director of Operations can add an
Upcoming home by calling the database directly. Three live accounts have manager without admin or
onboarding. The app already refuses them (`canAddHome`: admin, onboarding, or Director of Onboarding).

The fix changes one line: `public.is_onboarding_staff(me)` becomes `public.has_role(me, 'onboarding')`.
Nothing else in the function changes, and its grants stay as they are.

Files
- `00_preflight.sql` stops unless the live function is still the Nov 12 version.
- `apply.sql` replaces the function and writes one audit_log row.
- `apply.undo.sql` puts back the Nov 12 live version and writes one audit_log row.
- `live-capture/add_upcoming_onboarding_home.sql` is the live function as read Nov 13.

Practice run: `src/lib/__tests__/add-upcoming-access-fix-sql.test.ts`, and the older
`onboarding-home-sql.test.ts` now checks the current rule instead of expecting a PM to be refused.
