# Onboarding & Operations activation — five items

Two of the five need a decision from you before they can go live; three are straight builds. All of it keeps the existing role rules, database guards and tests intact.

## 1. Breezeway dispatch for all verified homes

Today the dispatch button is switched off entirely. The underlying rule is already the right one: a home can only receive a Breezeway task while Resolve has **verified** its Breezeway/OwnerRez identity match — no hand-picked pilot list.

Plan: turn the switch on and let the verified check do the gatekeeping, so every verified home is dispatchable and unverified ones are refused with a clear reason. Onboarding task drawers get the dispatch action alongside the existing ticket path.

Before turning it on I will re-run the identity audit and tell you how many homes come back verified, so nobody is surprised by which homes can and cannot be dispatched on day one.

## 2. Taking the email composer live

**This one I cannot switch on from the code.** Emails currently record as "not delivered" for one reason: the Microsoft 365 shared mailbox (info@arealhomeaway.com) is disconnected, so there is nothing to send through. Reconnecting it is a sign-in you have to do — I will point you at the exact screen.

What I will do in this build:
- A clear connection banner in the composer while the mailbox is disconnected, so nobody sends into the void.
- A live check after you reconnect: one real test message from a ticket, confirmed in the delivery log.

Nothing about the composer, recipients, templates or signatures changes.

## 3. Budget & Expenses on every onboarding property

There is no budget tracker yet — money currently lives only in individual approval requests. So this is a new tab on each onboarding property showing, per home:

- Approved budget and how it was set
- Estimated, committed and actual spend, with the gap
- Category rollups (staging, furniture, contractor, other)
- Line items with vendor, status and evidence
- Change history: every budget change with who changed it, when, and the written reason

PMs and Kati can add and edit lines; approvals over the existing thresholds still route through the current approval path. Existing spend already recorded as onboarding money requests is pulled in so nothing is entered twice.

## 4. Assessment findings become tracked correction tasks

When a finding is recorded during New House Setup, Pre-Work or a Standard Assessment (missing remote, damaged blinds, plumbing fix), Resolve creates a correction task on that home automatically:

- Linked back to the finding, so nothing gets orphaned
- Assigned to the functional owner for that kind of work
- A due date from the finding's severity
- Photo evidence required before it can be closed

Findings capture: what, where, severity, photo. Recording the same finding twice does not create a second task.

## 5. Vendor staging & trade coverage lookup

A coverage panel on the onboarding property, from the vendor records we already keep: which vendors cover that home's market (DFW, Tulsa, Indy…), what each is verified to do, their pricing tier, and the backup contact if the first choice is unavailable. Read-only reference — no dispatch from here.

## Technical notes

- Item 1: flip the `breezeway_outbound` flag; eligibility stays server-side on `breezeway_mapping_state = 'verified'`, plus the dispatch action in the onboarding task drawer. No hardcoded ids.
- Item 2: no code path can bypass `mailConfig()`; the allowlisted single mailbox stays the hard boundary. Banner + post-reconnect verification only.
- Item 3: additive migration — `onboarding_budgets` (one per project) and `onboarding_budget_lines`, with GRANTs, staff-only RLS via `is_internal_staff`, and an append-only `onboarding_budget_changes` history table. Reads join existing `financial_requests`.
- Item 4: additive migration — `assessment_findings` with a trigger that inserts the correction task (existing onboarding task / ticket model, `evidence_required = true`), keyed for idempotency. Owner resolution reuses the functional-role mapping.
- Item 5: pure read module over `vendor_orgs`, `vendor_service_areas`, `property_vendor_coverage` and `vendor_contacts`; new component on the property overview.
- Tests: pure-module tests for budget rollups, finding→task mapping and coverage matching; SQL tests for the new RLS and the finding trigger. Full `bun test` and typecheck must pass.
