# Onboarding portal UX inventory (read-only, source-based)

Nothing was changed. Counts come from the code, not from live screens. Anything that depends on role or data is marked Not verified.

## 1. Screen by screen
| Screen | Sections in order | Actions on load | Filters | Shown twice |
|---|---|---|---|---|
| Home | Header, owner-review count, Onboarding properties, Upcoming handoffs, Needs my attention, activity | 11 (12 for Director) + row actions | 4 | Same properties in 3 lists |
| Properties | Search/test toggle/lenses, property cards, Workload by PM (collapsed) | Not verified | 2-3 | No |
| My Tasks | Due/overdue, This week, Blocked/Waiting, Later (collapsed) | 0 fixed + row actions | 3-4 | No |
| Owner Completions | To review / All, cards | 2 + 3 per card | 2 | No |
| Team | Roles needing a person, Director, role cards, Primary PM by home, accounts, Welcome email | Depends on data | 0 | No |
| Templates (list) | Templates, owner-email copy | 1 + 1-4 per template | 0 | No |
| Template (open) | Plan settings, Stages, step list, preview, **older step editor** | Grows with steps | 0 | **2 Close buttons, 2 editors for the same steps** |
| Utilities & Accounts | Status chips, search/service/test, homes, service cards | 2 per card | 3-4 | No |
| Project header | 5 tabs | 5 + permission-based | 0 | No |
| Overview | Summary/health, Dates, Team/Providers, Needs attention (5), Owner items | Depends on data | 0 | Dates shown as text and as editing controls |
| Tasks tab | CSV, New Task, Owner completions, notices, queue | 2 + filters + rows | 2 + queue filters | No |
| Property Details | 12 panels (facts through findings) | Not verified | 0 | Not verified |
| Handoff | Ready for Operations, Operations acceptance | Depends on state | 0 | No |
| Files & History | Photos, documents, history, retired Tasks | Not verified | 0 | No |
| Task drawer | Status, guidance, evidence, assignment/dates/notes/history | Depends on Task type | 0 | No |
No screen uses column tables. Nested Property Details tables: Not verified.

## 2. Duplication across screens
- Tasks appear on 4 screens: Home (per-home attention), My Tasks (mine, quick-complete), Overview (top 5), Tasks tab (full list, bulk edit). Each behaves differently.
- Owner Completions page and the Tasks tab use the same review cards. The Tasks tab shows one home only.
- Assignment happens in 3 places: Team (who is eligible, plus Primary PM), Project Team (people on this home), Task drawer (one Task). The controls look alike but do different things.
- Status appears in 5 forms: health/progress, queue counts, owner-review badges, lifecycle selector, handoff steps.

## 3. Developer language (suggested wording)
- Templates: "Published version {n}" / "Publish new version" -> "Last published {date}" / "Publish changes"
- Template step: "A missing anchor date leaves the Task undated." -> "If the reference date isn't entered yet, this task won't have a due date."
- Template step: "Module (optional)" -> "Category (optional)"
- Older editor: "active_owner, design" and "Tag a step active_owner..." -> a "Completed by homeowner" checkbox
- Source records (Admin): "Source databases", "source: … · database ID …" -> "Connected systems", "System: {name}"
- "external-sync workflow control is off" -> "Automatic imports are turned off."
- Owner preview "· {kind}", Financial "Kind", asset "{name} · {kind}" -> "Item type" / "Expense type" / friendly equipment name
- Welcome email: "Demo — never sent" -> "Test email — not sent"; "e.g. Mood boards v2" -> "For example, updated mood boards"
- Bulk edit: "homeowner or Active Owner Tasks were left as non-blocking" -> "homeowner tasks still won't delay handoff"
- Not found as visible text in the code: seat, pool (as a staffing word), V2, snapshot, offset, schedule_anchor, functional role, owner_dependency, QA. Wording that comes from saved data: Not verified.

## 4. Densest screens (ranked by reading the code; Not verified)
1. Property Details: 12 panels. Hide scope/lifecycle, finance, owner preview and assessment history behind toggles.
2. Open template: two editors plus stage settings. Keep one editor and put publish/history under Setup.
3. Team: staffing, accounts and welcome email together. Move Accounts and Welcome email to their own tabs.
4. Tasks tab: owner reviews plus queue, CSV export, New Task and bulk edit. Put CSV and bulk edit under "More" and shrink owner reviews to a count.
5. Task drawer: work, reassignment, exceptions, evidence and history. Put reassignment and history in a details section.

## 5. Leftovers
- `/onboarding/transitions` has no menu link. `/onboarding/properties` only redirects.
- Old stage names are still shown ("Post contract — pre-inspection", "Phase 1–6") alongside Stage 1–8. The older editor still offers them.
- The older template editor still appears directly under the new one.
- The Handoff tab uses the two-step handoff. Whether old release buttons can still be reached elsewhere: Not verified. Pipeline Forecast / Project Portfolio are marked retired.

## Not verified
Live screens by role, exact element counts, wording from saved data, nested table columns.

## Next step (needs your approval)
No changes are proposed in this plan. If you approve, the next pass would be a read-only check in the browser, signed in as Director, PM and Admin, to confirm these counts.
