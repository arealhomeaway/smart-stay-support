# answer-read-home-team (Approved by the Admin, Nov 17; applied live as migration 0351)

Lets Project Managers, Utilities and anyone assigned a Task on a home read that home's saved
homeowner answers (`ao_contributions`: answer text and file list). Read only.

- apply.sql: helper `private.ao_answer_home_reader(user, home)` (staff, and PM / utility manager /
  `role_assignments.utilities` on the home's onboarding project, or assignee of a non-archived
  Task on the home); one added SELECT policy `ao_contrib_read_home_team`; grants; audit row
  `answer_read_home_team_applied`. The existing `ao_contrib_read` policy is unchanged.
- apply.undo.sql: drops the added policy and helper; audit row `answer_read_home_team_undone`.
- Not included: a home's Property Coordinator. No per-home coordinator record exists, so
  coordinators read answers only where they are assigned a Task on that home.
- Practice (rolled back, Nov 17): before, all four test users read 0 answers. After: the Fern PM
  read 5 (4 on Fern), a PM on one other home read 1 (0 on Fern), an Operations manager and a
  tech with no Tasks read 0. Every update attempt changed 0 rows.
