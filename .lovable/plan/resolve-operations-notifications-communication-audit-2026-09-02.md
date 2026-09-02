# Resolve — Operations Notifications & Communication Audit

Audit only. Nothing below has been built or changed.

## Headline finding

Resolve today has **no staff notification system**. Every operational signal — assignment, escalation, handoff, approval, SLA breach, Claim deadline, Work Order next action — is **display-only**: it exists as a queue, chip or count that a staff member sees *only if they are already inside Resolve and looking at the right screen*. If Resolve is closed, nobody is told anything.

The only live outbound messaging is:
- **Owner alerts** (email) — queued by database triggers into `owner_notifications`, drained every 5 minutes by cron to `/api/public/hooks/owner-notify`.
- **Team invitations** (email) — one-off, on invite creation.

`email_log` confirms this: the only rows ever sent are `owner_alert` (7) and `team_invite` (8). No staff operational email has ever been sent.

## 1. Current notification inventory (live vs. not)

| Mechanism | Trigger | Recipient | Channel | Timing | Live today? | Works when app closed? |
|---|---|---|---|---|---|---|
| Owner ticket alert | DB trigger `notify_owner_of_ticket` writes `owner_notifications` | Homeowner | In-app owner inbox + email | Inbox instant; email within 5 min (cron) | Yes | Yes (email) |
| Owner review alert | DB trigger `notify_owner_of_review` | Homeowner | Same | Same | Yes | Yes |
| Owner participation pace nudges | Daily evaluation in `owner-progress-alerts.server.ts` via the same cron | Homeowner | Email + owner inbox | Within 5 min of evaluation | Yes | Yes |
| Owner "reach this homeowner" contact task | P1 alerts that ask for a text | Staff (as a queue row in `owner_contact_alerts`) | In-app only | On drain | Yes | No |
| Team invitation | Invite created | Invitee | Email | Immediate | Yes | Yes |
| Toast messages (`sonner`) | Any action the user just performed | The acting user | In-app, transient | Immediate | Yes | No |
| Hub attention line | Query of open tickets on `/hub` | Staff | In-app text on Operations card | On page load (60s cache) | Yes | No |
| Operations dashboard queues ("Escalated right now", "Needs attention now") | Live query | Staff | In-app list | On page load | Yes | No |
| My Work / My Claims / My Recoveries / My Work Orders queues | Live query | Assignee | In-app list | On page load | Yes | No |
| P1 escalation ladder (`P1_ESCALATION`, 15-min staffing step) | Elapsed time, computed at render | Nobody — it is a computed label | In-app text | On page load | Displayed only | No |
| Assignment (`auto_assign_ticket` trigger + audit) | Ticket assigned/reassigned | Assignee | **Nothing** | — | Not implemented | No |
| Handoff requested/accepted/rejected | `handoffs` insert/update | Counterparty | **Nothing** — panel refresh only | — | Not implemented | No |
| Approval required (`approvals`) | Row created | Approver (James/Micah/owner) | **Nothing** | — | Not implemented | No |
| SLA response/action-plan/guest-update breach | Computed clocks in `tickets.ts` | Nobody | In-app chips | On page load | Displayed only | No |
| Guest Recovery escalation flag | Computed | Nobody | In-app | On page load | Displayed only | No |
| Work Order owner-approval-waiting / next action | Computed `work-orders.ts` | Nobody | In-app | On page load | Displayed only | No |
| Claim deadline approaching | Computed `claims.ts` | Nobody | In-app | On page load | Displayed only | No |
| Vendor commitment missed | No detector exists | — | — | — | Not implemented | No |
| @mentions in ticket notes | `extractMentions` stores names in `ticket_activity` metadata | Mentioned person is **not** told | — | — | Stored, not delivered | No |
| Browser notifications | `Notification.requestPermission()` exists only on the **owner** portal page | Owner | Browser | — | Permission asked; no operational staff use | No |
| Mobile / PWA push | No manifest, no service worker, no push subscription | — | — | — | Not implemented | No |
| Outlook-based notification | Outlook is **inbound intake only** (`/api/public/sync/mailbox`, every 10 min) | — | — | — | No outbound staff notification | No |
| Realtime subscriptions | None anywhere in the app | — | — | — | Not implemented | No |

Scheduled jobs that actually run: `deliver-owner-alerts` (5 min), `resolve-mailbox-sync` (10 min), `quarterly-inspection-scheduler` (daily 13:00 UTC). None of them notify staff.

## 2. Role-by-role map (today)

| Role | Notified about | Reality |
|---|---|---|
| Property Operations Coordinator | Nothing pushed | Must open Resolve and check Operations home / My Work |
| Guest Experience / Reservations Coordinator | Nothing pushed | Same; guest email arrives in Outlook shared inbox, not from Resolve |
| James / Operations Supervisor | Nothing pushed | Approvals, oversight queue, escalations all pull-only |
| Micah / Director of Operations | Nothing pushed | Escalations and manager views are pull-only |
| Homeowner | Ticket, review and pace alerts | Email + owner inbox — the only fully working channel |
| Vendor | Nothing (portal not live) | — |

## 3–7. Verification of the specific flows

- **Assignment (normal, after-hours/on-call, reassignment, accepted handoff):** the record's owner changes and the audit trigger logs it. The new owner receives no alert of any kind. Outside Resolve they will not know. After-hours is the worst case: on-call routing correctly picks a person, and then tells nobody.
- **SLA / urgency:** Resolve **displays** overdue and escalation state; it never pushes. P1's 15-minute staffing escalation step is a label rendered from elapsed time. P2 action-plan and guest-update clocks, and P3 overdue markers, behave the same. Nothing fires if no one opens the app.
- **Handoff:** ownership correctly stays with the sender until acceptance, and rejection requires a reason — but the recipient learns about it only by opening the ticket, and the sender learns of acceptance only by re-opening the panel. Outside Resolve: silence both directions.
- **Approvals:** Guest Recovery approval (James), Guest Recovery escalation (Micah), Work Order owner approval, and supervisor attention all create `approvals` rows that surface in queues. No approver is told. The owner-approval case is the highest business risk because it stalls spend authority.
- **Claims / Work Orders:** deadline-approaching, platform-info-requested, owner-waiting and ready-for-next-action are all computed and displayed. Vendor missed commitment has no detector at all.

## 8. Communication boundary

Current internal-communication surfaces:

| Surface | Behaves like | Recommendation |
|---|---|---|
| Ticket activity log | Immutable record | Keep as documentation — this is the operational record |
| Ticket notes / internal notes | Mostly documentation, drifting toward chat | Keep, but frame as "note for the record", not conversation |
| @mentions in notes | Chat expectation with no delivery — worst of both | Either deliver as a notification or remove the affordance |
| Onboarding notes | Documentation | Keep |
| Handoff summary / rejection reason | Decision record | Keep |
| Guest/vendor comment threads (Breezeway mirror) | External system's chat | Keep read-only, transitional |

Boundary to state explicitly in the product: **OwnerRez = guest/channel communication. Telegram = live internal and vendor conversation. Resolve = ownership, next action, decisions, approvals, evidence, record.** No chat should be built in Resolve.

## 9. Recommended minimal notification standard

Principle: notify only when a **named person must act**, and never more than once per event per channel.

| Event | In-app | Email | Push | Notes |
|---|---|---|---|---|
| Assigned to you | Yes | Yes | Later | The single biggest gap |
| Handoff awaiting your acceptance | Yes | Yes | Later | Also notify sender on acceptance/rejection (in-app only) |
| P1 SLA risk / breach | Yes | Yes | Later | Fire at the 15-min staffing step, to owner + supervisor |
| P2 action-plan or guest-update overdue | Yes | Digest | No | One consolidated message, not per ticket |
| Approval required (you are the approver) | Yes | Yes | Later | James, Micah, and owner-approval Work Orders |
| Escalation triggered | Yes | Yes | Later | Supervisor + Director |
| Vendor commitment missed | Yes | Digest | No | Requires a detector first |
| Claim deadline within 48h | Yes | Digest | No | Owner of the claim |
| Reopened item | Yes | Yes | Later | Previous owner + current owner |
| Everything else (status changes, notes, evidence added) | Feed only | No | No | Anti-fatigue rule |

Delivery shape: a `staff_notifications` table written by the same trigger-plus-drain pattern already proven for owners, an in-app bell with unread count in `AppShell`, and reuse of the existing Outlook shared-mailbox sender for email. Browser/mobile push is deliberately deferred — it needs a PWA manifest, service worker and subscription storage, and is not required for tomorrow's rollout.

## Minimum required before team rollout

1. `staff_notifications` table + RLS (recipient-only read, service-role write).
2. In-app bell with unread count and a notifications list.
3. Triggers/writers for: assigned to you, handoff awaiting acceptance, approval required, reopened item.
4. Email fan-out for those same four events through the existing sender, added to the existing 5-minute cron drain.
5. Per-user quiet handling: one email per event, coalesced; no email for events you caused yourself.

## Can wait

- P1/P2 SLA breach detector job (needs a scheduled evaluator, not a trigger).
- Vendor missed-commitment detector.
- Claim deadline digest.
- Browser/mobile push and PWA.
- Notification preferences UI.
- Any form of chat or mention delivery.

## Technical notes

- Reuse: `owner_notifications` → drain pattern in `owner-notify.server.ts`, `sendEmail`/`emailShell` in `email.server.ts`, `email_log` for delivery visibility, cron job `deliver-owner-alerts` (extend rather than add a second job).
- Staff email addresses come from `profiles`; no new secrets or scopes are needed.
- No change to tickets, work orders, claims, guest recovery, routing, SLA, evidence or closure logic is required for the minimum scope.

Awaiting approval before any implementation.
