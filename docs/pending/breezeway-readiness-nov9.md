# Breezeway bridge readiness (report only, Nov 10 2026, for the Nov 16 launch)

Report only. No code, database row, setting, job or Breezeway task was changed, read through Resolve or sent. Checks were read-only database queries, a read of the code, and a check that the three Breezeway keys are saved (values not shown).

Decisions this is measured against: register T15 and C6, and the Nov 9 punch list.

---

## 1. State today

### Switches (feature_flags)
| Switch | State | Since | Notes |
|---|---|---|---|
| breezeway_bridge | OFF | Aug 26 2026 19:20 UTC (never changed, updated_by empty) | Only read by the Integrations status card (`src/lib/breezeway-status.server.ts:27-36`). No code path checks it before doing anything. **It is not a real switch.** |
| breezeway_outbound | ON | Sep 22 2026 14:48 UTC | Description still says "Pilot property only", but see section 4: sending is open to every verified home today. |

### Scheduled jobs (cron.job)
No Breezeway job exists. The ten jobs are: quarterly scheduler (off), mailbox sweep (off), cleaner hours reconcile (on, 07:00, 07:30, 08:00 and 08:30 UTC; last run Nov 9 08:30, ok), cleaner weekly digest, owner alerts every 5 minutes, two nightly backups, Direct Booking escalation every 20 seconds, ticket timed alerts every minute, handoff reminders.
- The Breezeway mirror sweep route `/api/public/hooks/breezeway-mirror` exists but **no job calls it**. Its caller check uses the public project key, not the private scheduler secret (same weakness fixed for email intake).
- Breezeway reads happen inside the cleaner reconcile job (people directory nightly, cleaning tasks for tracked homes). Last 5 runs Nov 5 to Nov 9: complete, 0 errors, 8 to 11 tasks seen, 0 to 3 snapshots.

### Webhook
- One subscription row: type task, receiver host **smart-stay-support.lovable.app (the published app)**, registered Aug 28 2026, active, note "Fitzgerald pilot. Company-wide delivery; only company 3641 / home 1473933 retained." The note is out of date: code now keeps any verified home.
- No Breezeway subscription id is stored (the column is empty), so Resolve cannot itself confirm the subscription in Breezeway.
- Because deliveries go to the published app, **what the bridge does on launch day is whatever is published then**, not what is in the preview.
- Deliveries are live: 43,953 events Aug 28 to Nov 10 00:49 UTC. Last 4 days: processed 144, 140, 173, 296; verify failures 1, 0, 3, 7.
- Totals: processed 20,592; duplicate 16,810; ignored outside verified portfolio 1,073 (since Sep 1); outside pilot or beta (older) 5,388; verify failed 62 (429 x42, 401 x11, 500 x9); stale 19; invalid 1.
- 43 retryable verify failures are still open (never recovered). Recovery is a manual Admin action.

### Account and credentials
- Saved keys: BREEZEWAY_CLIENT_ID, BREEZEWAY_CLIENT_SECRET, BREEZEWAY_WEBHOOK_PATH_TOKEN are all set (values not read).
- integration_tokens (provider breezeway): company "A Real Home Away", token obtained Nov 9 13:44 UTC, expires Nov 10 13:44 UTC (24 hour token, refreshed as used). Last connection test: **Aug 28 2026**, passed, no error since.
- The 401 and 429 failures on Nov 9 13:44 show a token refresh moment and the rate limit being hit.
- Not checked: whether write access works (never tested, `writeAccessTested: false`), and which Breezeway user the keys belong to.

### What is mirrored
| Table | Rows | Oldest | Newest | How it arrives |
|---|---|---|---|---|
| breezeway_work_orders | 5,202 (159 homes, all matched to a Resolve home) | created in Breezeway Sep 18 2023 | synced Nov 10 00:49 UTC | each webhook re-reads its task; the full sweep has not run since Sep 1 |
| breezeway_work_order_comments | 911 | Sep 1 | Nov 10 00:19 | webhook, after the task re-read |
| breezeway_work_order_photos | 27 | Sep 1 | Sep 1 | only when staff open a work order; never refreshed since |
| breezeway_people | 143 | Sep 1 | Nov 9 07:00 | nightly, in the cleaner job |
| cleaner_task_snapshots | 107 | Sep 29 | Nov 10 00:44 | webhook plus nightly |
| breezeway_outbound_tasks | 0 | | | Resolve sends (none ever) |
| breezeway_sending_settings / history | 0 / 0 | | | Admin panel (never saved) |

Work order status mix: Created 1,241; Finished 569; Approved 1,471; Closed 585; Deleted 1,275; In Progress 61. Updated in the last 24 hours: 205.
- 382 Finished maintenance work orders have no finished time (finished_at empty). Only 1 work order in the whole mirror has one.
- Verified homes: 158 (154 active operations, 4 onboarding). Last full mapping sweep Sep 1 (properties.breezeway_synced_at), none in the last day.

**Is the mirror current?** For tasks that change: yes, within about a minute, through the webhook. For tasks that never send an update (and any webhook that failed): no. The safety sweep is not scheduled and last ran Sep 1. Photos are not current.

---

## 2. What switching the bridge on does

**Nothing.** No path reads `breezeway_bridge` before acting. Turning it on only changes the Integrations card to "Sync enabled". Leaving it off does not stop the webhook, the mirror, the cleaner job or manual escalation.

Paths that make Resolve work from Breezeway records today:

| Path | From | Creates | Automatic? |
|---|---|---|---|
| Escalate a mirrored work order (`createTicketFromWorkOrder`, `src/lib/breezeway-routing.server.ts:218-294`) | one mirrored work order | an Operations Ticket | **No.** A staff member presses it on the work order |
| Maintenance review list (`MaintenanceReviewQueue.tsx`, `RecordRoutinePanel.tsx`) | Finished maintenance work orders | a routine_controls row `bz_maint:<id>`, Team B | **No.** The row is made when someone opens the item |
| Departure clean trigger (`breezeway_clean_departure_review` on breezeway_work_orders) | a finished housekeeping clean matched to a reservation | departure_reviews plus cleaning_reviews, Team B | Yes, but **only for demo homes**: app setting `departure_review_live_homes` is not set, so real homes get none (3 demo rows, all Oct 2) |
| Cleaner hours (`cleaner_ingest_task`) | cleaning tasks on tracked homes | hours snapshots and review items | Yes (accounting only, not Tickets) |
| Onboarding completion reconcile | a task Resolve sent | completes the linked onboarding Task | Yes (only for Resolve-sent tasks; none exist) |

What an escalated Ticket gets:
- Title: work order name, or "Breezeway task N".
- Description: the work order description.
- Home: the matched home (refused without one).
- Priority: the P1 to P3 the staff member picks.
- Department and status: department operations, status open.
- Source: source breezeway, external id and link. The link shape is `app.breezeway.io/tasks/N`, but departure reviews use `/task/N`; one of the two is wrong.
- **Not set:** work type, entry kind and owner.

Team and group: the Team Queue shows it under From Breezeway in Team B, because a Breezeway Ticket with no work type falls back to Team B (`src/lib/automated-sources.ts:53-63`).

**Owner, confirmed live:** the live `auto_assign_ticket` (migration 0296, fix batch 4) returns early for external_source email, ownerrez or breezeway, leaving no owner and the note "Waiting in the Team Queue for the team to take it." The old Team B routing (`routeBreezewayTicket`) is still in the file but is never called. So today: **no owner**, as T15 says.

**Quiet until taken: not true today.** The live `run_ticket_timed_alerts` excludes only Notion imports. An unowned From Breezeway Ticket at Right now (P1) alerts the Operations Supervisor after the unowned-minutes setting. Clocks start at creation like any Ticket. No Breezeway Ticket exists yet (0 rows), so nothing has fired.

**Reported Issues:** no code reads them. The webhook accepts only type "task", and the task model has no report type, reporter or parent task fields.

---

## 3. Backfill and safeguards

- **No start line anywhere.** No setting, column or check compares a Breezeway task's time with a launch moment.
- The mirror sweep (when run) asks Breezeway for each home's tasks by page, with no "since" filter, keeping current ones. The webhook path re-reads any task it hears about, of any age.
- **Could old tasks create Tickets at once?** Not today, because nothing creates Tickets automatically. But:
  - If departure reviews are enabled for real homes, any finished, matched clean processed afterwards creates a review, with no date limit.
  - The maintenance review list shows every Finished maintenance work order with no completed review: 569 Finished today, 382 of them maintenance with no finished time. The newer Record routine work panel limits this to the last 14 days, a rolling window rather than a start line.
- Once-per-record guards that exist:
  - breezeway_work_orders unique on breezeway_task_id.
  - Webhook "processed once" unique on task id plus update time.
  - tickets unique on (external_source, external_id). A second escalation of the same task is refused by the database, but the screen says "Could not create the Ticket." instead of opening the existing one.
  - routine_controls unique on (kind, event_key).
  - departure_reviews unique event_key, plus one per home and reservation.
  - Outbound: unique request key, unique Breezeway task id, one in-flight send per record.
- **Copying the email intake pattern** (Nov 9 safety batch) would need:
  - A server action "Turn on Breezeway bridge" that sets breezeway_bridge on and, in the same step, sets a forward-only start line, recording who and when (off leaves the line).
  - Every creating path (future Reported Issue Tickets, maintenance review creation, departure reviews for real homes) checks both the switch and the start line, and records skipped items with a reason ("finished before the bridge started", "bridge is off").
  - Mirror and webhook keep running regardless, so data stays current.
  - Honest status on Integrations: switch, start line, last delivery, skipped counts, open failures.

---

## 4. Outbound

What Resolve sends (POST /task/ with home, name, description, department, priority, date and time, template, assignees; no automatic retry):
- **Onboarding Task drawer**, vendor mode, "Dispatch to a vendor" (generic panel).
- **Ticket's Work Order**, "Push to Breezeway" or "Retry Breezeway handoff", only for an accepted vendor with a mapped Breezeway person and an appointment (pilot dispatch path; `pilot_dispatch_ready()` returns true live).

Who may send: staff, with breezeway_outbound on, a non-demo and non-archived record, and the home passing two gates:
1. **Sending setting**: Admin panel on Integrations, "All verified homes" or "Pilot homes only" plus a list of homes. There is **no saved row**, so the default **All verified homes** applies.
2. **Verified mapping**: 158 homes are verified (identity checked against Breezeway inventory and the OwnerRez reference, not a test send).

So outbound is **already open to all 158 verified homes**, and 0 tasks have ever been sent. "Verified" means the home match was checked, not that a send was proven.

A **verification send** is not a thing in code. A safe one would go like this:
1. An Admin sets Pilot homes only with one test home (Fitzgerald, Breezeway home 1473933).
2. Send one task named "[RESOLVE TEST] Verification send, do not do" from a test Work Order, unassigned or assigned to an internal account, dated a week out.
3. Check the outbound row is created, the Breezeway task id is stored, and the webhook acknowledgement arrives.
4. Delete it in Breezeway.
5. Set All verified homes.

Sent twice:
- The same click or retry reuses the request key, so there is no second task.
- Only one send can be in flight per record.
- A timeout is held as "needs review" and never retried automatically. An Admin reconciles it on Integrations.
- A deliberate new send (new request key) after a success can create a second Breezeway task for the generic path. The accepted-vendor path refuses a Work Order already sent.

---

## 5. Review tasks

| Need (Nov 9) | Today |
|---|---|
| Created automatically when lawn or maintenance work finishes | Missing: listed from the mirror, created only when opened |
| Lawn included | Yes in practice: all 1,237 lawn work orders are department maintenance (72 Finished). Not a separate kind |
| Team B | Yes (property_operations) |
| Due in 24 hours | Partly: the panel shows finished time plus 24 hours, using update or schedule time when finished time is empty (382 cases). Saved rows have due_at equal to creation time (both open rows: due at once) |
| Only work finished after go live | Missing (no start line; 14-day rolling window in one panel, none in the other) |
| Breezeway link on the task | Missing on maintenance reviews; present on departure reviews |
| Cleaning reviews | Automatic trigger exists but is off for real homes (setting not set), has no 24-hour due time and no start line |
| Skip New House | Missing. One of the two open maintenance reviews today is "New House Setup - Stage Decor" |

Open review rows today: 2 maintenance reviews (Nov 6, Team B, no owner, due at creation): "New House Setup - Stage Decor" and "Lawn Care".

---

## 6. Skips

- **New House**: not recognised anywhere. Breezeway home tags are not read or stored. In Resolve labels there is only one label ("30-day firm"). The only clue in data is the task name: 220 work orders contain "New House" (194 maintenance, 24 inspection, 2 housekeeping).
- **Other companies' homes**: recognised only by not being a verified Resolve home.
  - The webhook checks company 3641 only when the payload carries a company id. All deliveries so far were 3641.
  - Deliveries for unmatched homes are recorded as "Outside verified portfolio" (1,073 since Sep 1) **without the home id**, so it cannot be seen which homes those were.
  - Weakness: if the verified home lookup finds nothing, the code falls back to the five old beta home ids (`isRetainedHome`, `breezeway-webhook.server.ts:55-63`). A beta home that is no longer verified would still be kept.

---

## 7. Failures

| Case | What happens | Where an Admin sees it | What the team sees |
|---|---|---|---|
| Duplicate delivery | recorded "duplicate", nothing done | Integrations, Breezeway webhook panel | nothing |
| Breezeway read fails (401, 429, 500) | "verify failed", retryable ones wait for manual recovery (43 open) | webhook panel, Recover button | nothing; the mirror is stale for that task |
| Event write fails | "persist failed", console log only | not recorded (the record itself failed) | nothing |
| Mirror refresh fails after a processed event | error swallowed; event still "processed" | **nowhere** | stale work order |
| Sweep upsert errors | not checked; counts as success | nowhere | stale data |
| Unmatched home | event "outside verified portfolio" (no home id); a re-read can store a work order with no home; escalation refused | webhook panel counts only | escalation message "Link the Work Order to a Resolve property first." |
| Missing field (no finished time) | review due time falls back to update or schedule time | nowhere | possibly wrong due time |
| Second escalation | refused by unique index | nowhere | "Could not create the Ticket." |
| Outbound timeout | "needs review", no retry | Integrations, outbound review panel | send shows as waiting for review |

integration_events has **no Breezeway rows**; the Breezeway failure record is the webhook table only.

---

## 8. Safe test plan (after the gaps are built, before go)

**Test marking.** A Breezeway task has a name, not a subject. A test is a task:
1. whose name starts with "[RESOLVE TEST]", and
2. which is on the one designated test home (Fitzgerald, Breezeway 1473933), and
3. which was created by an ARHA Breezeway user.

All three are needed. A test creates its Ticket or review with the existing demo marking (Test chip, no counts, no outbound email or owner message, alert text starts with "Test"), and Clear test records archives it.

| Step | Do | Expect | Check after |
|---|---|---|---|
| 0 | Before: note counts of tickets (source breezeway), routine_controls maintenance_review, departure_reviews, webhook events | baseline | |
| 1 | Bridge off: Emily or the account manager creates "[RESOLVE TEST] Reported issue" on the test home | webhook processed, mirror row, **no Ticket**, a skipped line "bridge is off" | counts unchanged |
| 2 | Admin turns the bridge on | start line equals that moment, who and when recorded | Integrations shows On and the start line |
| 3 | Touch an old finished maintenance task on the test home (add a comment) | no review created; skipped "finished before the bridge started" | counts unchanged |
| 4 | New "[RESOLVE TEST] Lawn check" on the test home, mark Finished | one maintenance review, Team B, no owner, due 24 hours after finish, Breezeway link, Test chip | one row; not in counts or scorecard |
| 5 | Mark the same task Finished again or edit it | no second review | still one row |
| 6 | New "[RESOLVE TEST] Reported issue" (Reported Issue type) | one unowned From Breezeway Ticket, Team B group, no alert and no clock until Take it (per decision) | Team Queue shows it with Test chip |
| 7 | Coordinator presses Take it | owner set, clocks start | history line |
| 8 | Task on a "New House" tagged home, and one on a non-ARHA home | nothing created; skipped with the reason | skipped counts go up |
| 9 | Test clean on the test home with a test reservation | one departure and cleaning review, Test chip | one row each |
| 10 | Outbound verification send (section 4) | one outbound row with a Breezeway id; a resend makes no second task | delete the Breezeway task |
| 11 | Clear test records | all test rows archived or closed with the reason | counts back to step 0 |
| 12 | Bridge off again | nothing new created; start line unchanged | |

---

## 9. Readiness list

Sizes: S under half a day, M about a day, L two or more days. Builder means the build agent (Claude, here in Lovable).

| # | Must be true | Who | Size |
|---|---|---|---|
| 1 | breezeway_bridge is a real switch with a forward-only start line set on turn on, who and when recorded | Builder | M |
| 2 | Reported Issues reach Resolve: confirm how Breezeway sends them (webhook type or task fields, reporter, parent task) | Breezeway account manager first, then Builder | S (answer) + L (build) |
| 3 | Reported Issues create one unowned From Breezeway Ticket for Team B, once per issue, after the start line | Builder | M |
| 4 | Quiet until taken: unowned From Breezeway items start no clocks, alerts or counts before Take it. The live timed alert excludes only Notion today; email and OwnerRez items are in the same position | Emily decides scope; Builder builds | S to M |
| 5 | Maintenance and lawn reviews created automatically on Finished, Team B, due finish plus 24 hours, Breezeway link, start line, once per work order | Builder | M |
| 6 | Finished time is known: 382 Finished maintenance rows have none; read Breezeway's finished time on refresh | Builder; account manager confirms the field | S |
| 7 | Cleaning reviews for real homes: turn on `departure_review_live_homes` through its setting, add start line and 24-hour due | Emily approves; Builder builds | M |
| 8 | New House skip: get home tags from Breezeway (or agree that a "New House" task name is enough) and skip | Account manager plus Emily decide; Builder builds | S to M |
| 9 | Other companies' homes: remove the old beta home fallback; record the home id on "outside verified portfolio" | Builder | S |
| 10 | Mirror sweep scheduled (for example hourly), with the private scheduler secret, refreshing photos too | Builder (staged) | S |
| 11 | Clear the 43 open verify failures (Recover) and run Test connection | Admin (Emily) | S |
| 12 | Failures visible: mirror refresh and sweep errors recorded and shown on Integrations | Builder | S to M |
| 13 | Second escalation opens the existing Ticket instead of an error; one Breezeway link shape (/task/ or /tasks/) | Builder; account manager confirms the link | S |
| 14 | Outbound verification send done (section 4) before All verified homes is kept | Emily (Admin) with Builder | S |
| 15 | Update the webhook note; confirm the subscription id with Breezeway | Account manager | S |
| 16 | Publish the bridge build before Nov 16: webhooks reach the published app | Emily approves publish | S |
| 17 | Test plan (section 8) passes; Emily says go | Emily | M |

Rough total: 5 to 7 build days plus the Breezeway answers. Items 2 and 8 depend on Breezeway and should be asked today.

## Could not check
- Real Breezeway task contents, tags, Reported Issue shape and write access: not allowed to read or send through Resolve.
- Whether Breezeway still holds the webhook subscription (no subscription id stored).
- What the published app is running versus the preview (the same code is assumed).
- Exact SLA clock start on an escalated Breezeway Ticket. The alert rule was read live; the full clock trigger chain was not traced.
