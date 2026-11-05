# Help ticket bulk updates, staged only

Do not apply or publish without separate approval. Tests use mocked notifications and isolated database fixtures. No real Help ticket or email was changed/sent.

## Setup and undo

Verify checksums and schema dependencies before applying `01_help_ticket_bulk.sql` byte-for-byte. Required existing objects: `help_tickets`, `help_ticket_events`, `profiles`, `auth.uid`, `has_role`, and `is_director`. The migration creates one replay-receipt table and three caller-authenticated functions. It changes no existing rows, policies, status values or single-ticket update behavior.

Keep `01_undo_help_ticket_bulk.sql`. Export receipts before undo if real bulk saves occurred. Undo removes only these new objects; per-ticket history, statuses and existing email logs remain intact.

## Authority and selection

The single-ticket rule already permits Admins and the Director of Operations. Bulk updates use that same server-checked rule, not broader Manager or Onboarding Director access. PCs, ordinary Managers and anonymous callers are refused. UI also respects read-only role previews.

Select all applies to all rows matching current status, type, portal and search filters. The old 500-row read cap is removed using ordered paginated reads. A selected count appears; filter changes clear selection. All six existing statuses remain available, including Resolved and Closed. Existing status filter is retained.

## Atomic writes and history

The one server action calls a transactional function that validates the entire set, locks rows in stable order, checks captured updated times, changes statuses, adds each ticket's own attributed status event, adds an optional note/reply event exactly as the single-ticket history uses, and saves the replay receipt. Any missing/stale row or history failure rolls everything back. Each selected ticket receives a status event even if already at the chosen status, documenting the explicit bulk action.

An optional note is kept on the status event and also in a visible note/reply event. Notifications off makes it an internal note. Notifications on includes it in the submitter-facing grouped message. Author and old/new status remain per-ticket. No browser loop of separate single-ticket writes is used.

## Notifications

Notify submitters is OFF initially and resets OFF after success. Off does not resolve recipients, claim delivery or call email services.

On, tickets are grouped by submitter account identity, falling back to normalized submission email only when no account identity exists. Current account email is resolved through the same helper as single-ticket responses. One grouped message includes all of that submitter's selected tickets and optional note. The existing Help ticket email purpose, email shell, authorized mailbox, email log and safety gates are reused. Every included ticket passes the shared delivery safety check.

Statuses and history commit before email, exactly like single updates. Email is not a database transaction: a mail failure leaves saved ticket changes intact and is reported separately. Delivery outcome is recorded on each included status event. A once-only batch claim plus a single provider attempt prevents duplicate grouped emails on a repeated Save. If the process stops after claiming delivery, unsent/unconfirmed events remain `sending`; no automatic retry is allowed. Check existing email logs and per-ticket history before separately resending. This favors duplicate-send safety over automatic recovery.

The browser retains the same request ID after an unconfirmed save; repeated Save returns its existing receipt without duplicate events or messages. Changes to selection/options are held until Cancel; Cancel refreshes the list. After confirmed success selection clears, the list/history refresh, and confirmation reads, for example, `12 tickets set to Closed`.

## Verification

14 pure/mock and isolated PostgreSQL tests cover note/no-note status saves, per-ticket history, default-off behavior, one message per submitter, denied callers, retained Director authority, full rollback, stale/missing rows, replay and delivery claims. Mocked desktop/mobile browser checks exercised filtered Select all, counts, optional note, default-off and on notification requests, confirmation and cleared selection. Real authenticated bulk updates and email delivery remain unverified because the migration is not applied and real writes/sends are prohibited.