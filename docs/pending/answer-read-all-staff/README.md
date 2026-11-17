# answer-read-all-staff

Approved by the Admin, Nov 17 ("Everyone should see the answers, that is the whole point").
Applied live as `drizzle/migrations/0352_answer_read_all_staff.sql` (identical to `apply.sql`).

- Every staff member (`private.is_staff`: admin, manager, tech, onboarding) may read every
  homeowner's saved plan card answers and their file list on every home. Read only.
- Replaces the 0351 home-team rule: drops policy `ao_contrib_read_home_team` and helper
  `private.ao_answer_home_reader`; adds policy `ao_contrib_read_staff`.
- `ao_contrib_read` (Admin, Directors, the home's own homeowners) is unchanged, so homeowners
  still read only their own. No insert, update or delete rule added.
- Audit row: `answer_read_all_staff_applied`. Undo: `apply.undo.sql` (restores 0351 exactly).
- `practice.sql`: before/after/undo reads and writes as five people; always rolls back.
