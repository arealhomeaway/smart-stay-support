Read-only findings: live-plan bulk edit and template push (no changes made)

1. LINK. Each home Task has a `template_task_id` column, but on real homes the link is mostly empty: Fitzgerald, W 104th, Foxtail and Buckland have 14 of 212 open Tasks linked (198 not linked). Galveston has 147 of 177 linked (30 not linked). Overall, 791 real open Tasks have no link. 704 of them match a template step by exact title, but titles are not a reliable key. Homes do record their source in `onboarding_projects.template_version_id`: Galveston uses one template version (c6f0cab5) and the other four use another (4cf1d232). Which template each version belongs to is Not verified.
2. HAND EDITS. Only due dates are flagged when changed by hand: `due_on_overridden` (currently 0 on all homes) and `due_on_source`. Stage moves go to `onboarding_task_stage_history` (1,065 rows). `audit_log` has 52 `onboarding_task_updated` entries, but which fields they cover is Not verified. Changes to role, required, blocks handoff or title have no per-field flag. Smallest reliable approach: (a) going forward, record hand edits per field (who, when, old → new) on the existing update path; (b) for existing Tasks, compare each linked Task to the template version it started from. If they differ, treat it as edited and do not push. Unlinked Tasks cannot be judged safely.
3. TODAY'S HOME EDITING. The home Task drawer (`TaskDrawer`, opened from the home's onboarding plan) edits one Task at a time: due date, evidence note and status actions. The exact field list and which roles can use it are Not verified. There is no bulk action for home Tasks.
4. TASK STATES. The values in use are `open` (1,371), `in_progress` (1) and `complete` (53); the date rule also recognises `done`. There is no skipped or waived status. Instead, `exception_reason/by/at` records exceptions and `archived_at` removes a Task. Due dates recalculate automatically: when a home's closing, access or handoff date changes, the date rule re-dates every open Task that came from a V2 template, is not hand-overridden and is not complete. Completed Tasks are never touched.
5. TEMPLATE STRUCTURE. Adding, deleting or moving a step on a template does nothing to homes already started. Nothing pushes changes automatically; homes keep the version they started on.
6. SCALE (real homes; demo homes excluded):
   - Fitzgerald: 205 open, 7 complete
   - W 104th: 212 open, 0 complete
   - Foxtail: 212 open, 0 complete
   - Buckland: 212 open, 0 complete
   - Galveston: 177 open, 0 complete
   That is four homes on version 4cf1d232 and one on c6f0cab5. The open counts likely include Subtasks.
7. RISKS
   - The missing links (about 94% on four homes) are the main blocker for any push.
   - Homeowner-approval and Active Owner steps: the database already forces these to stay non-blocking.
   - Breezeway: no outbound Breezeway tasks exist yet (0 rows), so no Work Order is tied to a Task today.
   - Tickets: no home Task is linked to a Ticket (0).
   - Opportunities: homeowner Opportunities sit beside Tasks. Changing a Task must never change its Opportunity, and Opportunity release counts must not shift.
   - Handoff: blocking and required Tasks feed handoff readiness, and a Task protection rule guards Tasks in the handoff. Changing blocks handoff or required could change a home's ready state.
   - Notifications: a due-date change itself does not send an alert (only Task completion does). Whether deadline alerts re-fire after a date moves is Not verified.
   - My Work: role, stage and date changes move Tasks between people's lists and change their counts.
   - Work items: a sync rule mirrors Tasks into `work_items`, so a bulk change becomes many synced writes.

Not verified: which template each version belongs to, the drawer's full editable fields and who can use them, the content of the 52 audit entries, whether deadline alerts re-fire, and whether open counts include Subtasks.
