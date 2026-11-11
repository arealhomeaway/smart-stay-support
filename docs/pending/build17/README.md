# Build 17 database change (Emily, Nov 10)

Applied as drizzle/migrations/0332_build17_review_date_and_project_team.sql after the tests passed
and a cancelled practice on the real database (rolled back, nothing kept).

- 01_build17.sql: what was applied (same statements).
  - Finding 8: guest_feedback.published_date_known (default true). False means OwnerRez gave no
    publish date; the review is history and starts no Guest reviews check or follow up.
  - Finding 9: public.can_manage_project_team(uuid), one rule for the screen and the save, equal to
    the home's existing row rule; set_onboarding_project_role now returns changed true/false, saves
    nothing when the person is unchanged, and a new Project Manager takes the home's unfinished
    Project Manager Tasks.
- 01_build17.undo.sql: puts back the previous set_onboarding_project_role exactly (migration 0208
  text) and removes can_manage_project_team. The new column is kept unless the code is also rolled back.

Practice result (rolled back): same person = changed false, nothing written; new Project Manager =
changed true and the home's unfinished Project Manager Tasks moved.

Nothing here touches templates, Active Owner switches, owner messages or Breezeway.
