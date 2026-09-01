# Outlook → Ticket / Lead intake (audit + build plan)

## A. Audit of what exists today

**Authentication.** One workspace OAuth2 connection, "ARHA Info Outlook Connector", routed through the Lovable connector gateway. Resolve never holds a Microsoft token: server code sends `LOVABLE_API_KEY` + `MICROSOFT_OUTLOOK_API_KEY` (both server-only env vars) and the gateway attaches Microsoft credentials and refreshes them. No Microsoft secret exists in the browser.

**Graph scopes granted.** `Mail.Read`, `Mail.ReadBasic`, `Mail.ReadWrite`, `Mail.Send`. `Mail.ReadWrite` already covers writing categories. No Calendars scope is enabled. Nothing broader is needed for the Ticket/Lead workflow — see section F for the one open question.

**Token refresh.** Yes, handled by the gateway. No refresh logic in app code.

**Subscriptions / webhooks.** None exist today. There is no Graph subscription, no notification endpoint, no renewal job. Detection is polling only: `src/routes/api/public/sync/mailbox.ts` (cron, shared secret) and a manual supervisor button in `MailboxIntakePanel.tsx`.

**Mailboxes accessible.** Exactly one, enforced server-side in `mailbox-allowlist.server.ts`: `EMAIL_SOURCE_MAILBOX` (info@arealhomeaway.com). Only `/users/<that mailbox>/mailFolders/Inbox/messages` is ever called — no `/me/*`, no user enumeration, no other folders. Because the connection is delegated, the workflow supports that one shared/team mailbox. Individual employee mailboxes are *not* supported and would each need their own consent (or an application-permission model) — not proposed here.

**Reading categories.** Yes, already: `categories` is in the `$select` list and `src/lib/mail-categories.ts` implements an exact, case-insensitive category protocol.

**Writing categories.** Yes, already: `PATCH .../messages/{id}` with a new `categories` array, with the unrelated categories preserved and de-duplicated.

**Identifiers.** Graph `id` (immutable within the mailbox/folder — it changes if the message moves folders) and `internetMessageId` (globally stable) are both read and both recorded. `conversationId` is available from Graph but is **not** currently selected or stored — this is the main gap for thread handling.

**Deep link.** Yes — `webLink` is already read and stored on the ticket as `external_url`.

**Content.** Subject, from, body/bodyPreview, receivedDateTime, internet headers are read today. Recipients (`toRecipients`/`ccRecipients`) and `hasAttachments`/`/attachments` are available but not currently requested.

**Attachments.** Reachable under the existing `Mail.Read` scope via `/messages/{id}/attachments`. Nothing is copied today.

**Idempotency today.** Reasonable and reusable: `integration_events` rows keyed `(system='outlook_inbox', operation='mailbox_message', external_id)`, one row per id (Graph id *and* internetMessageId), claim-before-create, stale-claim reclaim after 10 min, `recategorise_pending` marker for retrying only the category. **Gap:** the unique index that makes the claim race-safe was never applied — it is still sitting in `docs/pending/20260829-integration-events-mailbox-once.sql`. Without it two concurrent passes can both claim.

**Current behaviour that must change.** The existing categories are the old task vocabulary (`Resolve: create task` / `Resolve: task created` / `Resolve task: task completed`), and `classify()` still opens tickets for uncategorised mail that looks like work or carries an `[ARHA-000]` tag. That heuristic path is what previously created unwanted records.

## B. Category protocol (new, exact names)

| Purpose | Category |
| --- | --- |
| Trigger, Ticket | `Resolve: create ticket` |
| Trigger, Lead | `Resolve: lead management- create a ticket` |
| Created | `Resolve: ticket created` |
| Closed | `Resolve: ticket closed` |

Only these four are ever written; every other category on the message is preserved untouched. The old `task` categories are retired but still *recognised as already-handled* so historical mail is never reprocessed.

**Human-triggered only.** The heuristic "looks like work" path is removed. No category → no record, full stop. `[ARHA-000]` reply threading stays (it files a comment on an existing ticket; it never creates).

## C. Idempotency + thread model

Reuse `integration_events`, extended so one row carries the full mapping: mailbox, Graph message id, `internetMessageId`, `conversation_id`, trigger category, object type (`ticket` | `lead`), object id, created-at, sync state, attempt count. Stored via the existing columns plus `request_payload` JSONB for mailbox/conversation/trigger, so the schema change is small.

Order of operations, unchanged in shape from today: look up prior row by either id → decide `create` / `retag` / `skip` → claim → create record → write categories → settle. Claim safety depends on applying the pending unique index (section G, step 1).

**Threads.** Store `conversationId` on every row. When a trigger category appears on a message whose conversation already maps to a Ticket or Lead, Resolve does **not** create a second object. Recommended UX: it files the message as an activity/comment on the existing record, sets the message to `Resolve: ticket created`, and the admin log records it as "linked to existing ARHA-123 (same thread)". The employee sees the link in Outlook via the category and in Resolve on the existing record. A genuinely separate matter on the same thread is created the normal way from `/tickets/new`, which keeps deliberate duplication a conscious act rather than a silent one.

## D. Ticket flow

Category `Resolve: create ticket` → existing intake path (`createIntakeMatter`), which already runs the current work-type, priority, SLA, routing and permission logic. Nothing is bypassed. Prefilled from the email: subject as title, cleaned body excerpt, sender name/address, recipients, received time, mailbox, conversation id, `webLink`, attachment metadata (name/size/type only). Property is linked only by the existing exact name/nickname match; no fuzzy owner/guest/reservation inference.

## E. Lead flow

Category `Resolve: lead management- create a ticket` → a row in the existing `leads` table, entering the normal action-first workflow at stage `new` with the same derived follow-up engine. No generic Ticket is created. Prefilled where safely derivable: contact name and email from the sender, phone via a conservative signature regex, company from the sender domain when it is not a free-mail provider, subject/body into `requirements`/`notes`, `source_detail` JSONB carrying the Outlook provenance. `source` is set only when confident (e.g. a known insurance/relocation domain), otherwise left for the coordinator — parsing never blocks creation.

## F. Category lifecycle and terminal states

- Create succeeds → remove the trigger category, apply `Resolve: ticket created`. Never both.
- Ticket closes → `Resolve: ticket closed` (driven by ticket status, as today, so a close anywhere is picked up).
- Ticket reopens → back to `Resolve: ticket created`, same mapping row, no new Ticket.
- **Lead terminal states — recommendation:** map **both Converted and Lost** to `Resolve: ticket closed`. Rationale: the category's only job in Outlook is "is this still open work?" — a converted booking and a lost opportunity are both settled, and adding Lead-specific categories would fragment a protocol we are deliberately keeping to four names. The *reason* (converted vs lost, with the structured loss reason) lives in Resolve, which is where anyone would look. Leads sitting in `engaged`/`booking pending` stay `Resolve: ticket created`.

## G. Failures, retries, admin visibility

Record creation and category writing stay separate steps, as today: a category write failure never rolls back or duplicates the record; the row is marked `recategorise_pending` with an attempt counter and retried on the next event/sweep with backoff. After a threshold it surfaces as a failure in the admin log.

Event-driven with a safety net: a Graph change-notification subscription on the mailbox Inbox (`updated` + `created`), notification handled at a new `/api/public/hooks/outlook/messages` route (validation-token handshake, `clientState` secret check, fetch-by-id then evaluate — no message content is trusted from the notification body). Because delegated subscriptions expire (~3 days max), a renewal job runs on the existing cron, and the existing polling sweep is retained as reconciliation for missed events. Duplicate deliveries are absorbed by the mapping.

Admin view: a compact section in the existing Integrations page (extending `MailboxIntakePanel`) — recent creations, duplicates prevented, category-sync failures, retries pending, subscription health/expiry. No new dashboard.

## H. Security impact

No new Graph scopes required — `Mail.ReadWrite` already permits category writes, and subscriptions on the same mailbox need no additional permission. The single-mailbox allowlist, server-only tokens, and least-privilege posture are unchanged. Only messages carrying a Resolve trigger category are ever read in detail; the webhook returns 202 without echoing content, and the admin log stores subject/sender only. UI access stays behind existing staff capability checks; no route can be used to fetch arbitrary mailbox content because every Graph path is built by the allowlist helper.

**Actor ("Triggered by").** Graph does not report *who* applied a category on a shared mailbox — change notifications carry no actor. Recommendation: do not infer one. Display `Mailbox: info@arealhomeaway.com` and leave `Triggered by` blank unless we later add a lightweight mailbox audit-log lookup (separate enhancement, needs additional permission — not proposed).

## I. Schema changes genuinely required

1. Apply the pending unique index `integration_events_mailbox_once` (already written and reviewed).
2. Add nullable `conversation_id text` + index on `integration_events` (thread mapping), or carry it in `request_payload` — index preferred for query speed.
3. `leads`: nothing new required; Outlook provenance fits `source_detail` JSONB. Optional small addition of `external_source`/`source_reference` for parity with tickets.
4. New `integration_subscriptions` row usage inside `integration_events` (system `outlook_subscription`) rather than a new table.

Everything else — tickets, routing, SLA, leads workflow — is unchanged.

## J. Files expected to change

`src/lib/mail-categories.ts` (new names, legacy recognition), `src/lib/mailbox.server.ts` (category-only trigger, conversation mapping, lead branch, retries), new `src/lib/outlook-leads.server.ts` (email → lead), new `src/routes/api/public/hooks/outlook/messages.ts` (notification endpoint), new subscription create/renew helper + cron hook, `src/components/MailboxIntakePanel.tsx` (admin log), a compact "Created from Outlook" block on the ticket detail and `LeadDrawer.tsx`, and tests alongside the existing `mailbox-intake` / `mail-categories` suites.

## K. Smallest safe build sequence

1. Apply the unique index + `conversation_id` column.
2. Switch to the four new categories, remove the heuristic creation path (category-only). Tests.
3. Lead branch + email→lead derivation. Tests.
4. Conversation/thread linking behaviour. Tests.
5. Close / reopen / terminal-state category lifecycle. Tests.
6. Retry + admin log visibility.
7. Graph subscription + webhook endpoint + renewal, with polling retained as reconciliation.
8. "Created from Outlook" source blocks on Ticket and Lead.
9. Run the eight QA scenarios, then publish.

## L. What you must approve or configure on the Microsoft side

- **Nothing new in Entra** under this plan — existing scopes suffice. Confirm that is acceptable.
- **Category names must exist in the mailbox.** Someone with access to info@arealhomeaway.com should create the four categories in Outlook so employees can apply them from the dropdown. Confirm the exact spelling, including the unusual `lead management- create a ticket` hyphen/spacing.
- **Confirm the Lead terminal-state recommendation** (Converted and Lost both → `Resolve: ticket closed`).
- **Confirm** that the old `Resolve: create task` category is retired and will no longer be used by anyone.
