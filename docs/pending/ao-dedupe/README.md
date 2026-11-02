# Active Owner card de-duplication

Apply `01_dedupe.sql` through the migration tool (no BEGIN/COMMIT in the file). Undo: `undo.sql`.

- Switch-on and its preview mark a card already covered when the home has a live owner item on the card's linked Task, or one matching a confirmed entry in `ao_card_item_map`. The reason is stored on the plan card.
- A Task that already holds an owner item (even a withdrawn one) never fails switch-on.
- BEFORE INSERT guard on `owner_reviews` and opportunity `work_items` refuses a repeat of a live card on an automated home, unless staff confirmed a one-off (`ao_confirm_one_off`, single use, 30 minutes).
- Seeds 24 map entries and 26 step-link suggestions, all `suggested`. Accepting a link suggestion writes only `linked_template_task_ids` (plus version and history).
- After-handoff items carry `coverage` (`send` or `covered_by_card`); the scheduler skips items covered by a live card on the home.
- Replaces three live functions; their exact text (sql + base64) and ACLs are in `live-capture/`; undo restores them byte for byte.
- Never touches templates, versions, steps, home plans or Tasks. Tested in `src/lib/__tests__/ao-dedupe-sql.test.ts`.
