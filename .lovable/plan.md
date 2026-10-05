# Claims Workflow — Extend existing Claim record and queue

## 0. Close prior pass
- Vendor/onboarding development acceptance marked closed in roadmap.
- Launch checklist keeps: Micah own-account acceptance of "DEMO — Handoff Role QA Cottage", real Breezeway task, real vendor login, James/Emily own-account checks, KD Accounting seat, vendor Telegram confirmation. Real Director seat untouched.

## 1. Reuse, don't rebuild
- Keep `claims`, `claim_activity`, Claims Home / My claims / Manager pages, the Departure Review → Claim unique link, and Evidence Quality Gate.
- Links: property, issue reservation (existing booking fields), Work Orders, and shared Expenses via existing `expense_links` (`link_type='claim'`). Expense amount stays only on `expenses`.
- Recoveries reuse `expense_recoveries` (add `claim_id`, `accounting_reference`, correction fields) — no second ledger.

## 2. Guided stages (user-facing)
Evidence gathering → Ready to submit → Submitted → Awaiting decision → Decision received (approved / partial / denied) → Recovery pending → Closed with outcome.
Existing backend stages map onto these; no data rewrites. Next Action stays derived in `src/lib/claims.ts`.

Gates (DB-enforced):
- Submitted requires submission date, reference, and a submission-proof document.
- Decision requires decision evidence; approved/partial require approved amount; denied requires reason.
- Closed requires recorded outcome; any unrecovered amount requires a reason (denied, withdrawn, waived, unrecoverable).
- Requested, approved, received tracked separately; approval never counts as receipt. "Financially settled" only when received + documented nonrecovery covers requested.

## 3. Waivers
- PC requests waiver (reason + context) → routed to Operations Supervisor via existing role mapping, in-app notification.
- Supervisor approves/denies with notes → in-app notification back to responsible PC.
- Waiver never assigns cost to owner or ARHA; Finance treatment and leadership-exception path unchanged. Outstanding Finance decision stays visible.

## 4. Finance handoff
- Operations: evidence, submission, decisions, follow-up.
- Finance (existing finance_lead/accounting seats): record receipts (partial allowed), accounting reference, allocation across linked expenses capped at each expense amount. Corrections are append-only reversal entries.
- Claim stays in queue after repair work completes until financially settled.

## 5. Payer and deadlines
- Separate fields: reservation guest, booking source, contracting party, deposit payer (nullable, never defaulted from guest).
- Submission deadline and deposit-release deadline, each with source, timezone, verification status. Unknown → "Deadline needs verification". No invented platform rules.
- Deposit release / charge / refund / retain-funds shown as pending Finance decisions only — no actions performed.

## 6. Queue and permissions
- Rows show assignee, property, reservation, status, requested/approved/received, next action, due date, missing evidence, overdue follow-up.
- Follow-ups reuse `work_items` Tasks and in-app notifications, deduped by claim + reason key.
- RLS: internal staff only; Finance fields writable only by Finance seats (DB trigger); claim attachments staff-only; owners/vendors refused.

## 7. Acceptance (synthetic accounts/records, demo home)
Departure Review links to its existing Claim without duplication · evidence → submission → decision · partial approval + two partial receipts · denial with Finance follow-up · waiver approve and deny returned to PC · deposit payer ≠ guest · unknown deadline stays unverified · unauthorized access and Finance edits refused. Core browser walkthrough plus full automated tests.

## Technical details
- One additive migration: new claim columns (payer fields, deadline source/tz/verified, submission/decision evidence ids, nonrecovery reason, waiver fields or `claim_waivers` table), `expense_recoveries.claim_id` + correction columns, guard trigger, waiver/receipt RPCs, notification hooks, follow-up dedupe key.
- Pure rules in `src/lib/claims.ts` (+tests); UI in claim workspace and `ClaimList`.
- AGENTS.md rule for claims ledger/gating.

## Open policy questions (work continues around them)
1. Who is "Operations Supervisor" for waiver routing if several hold the seat — all, or the property's Pod supervisor?
2. Should a supervisor-approved waiver auto-close the claim, or still require Finance acknowledgement?
3. Any verified platform deadlines (Airbnb AirCover 14 days after checkout, Vrbo) you want stored as confirmed defaults? Otherwise all stay "needs verification".

Nothing published; no external submissions, messages, payments, deposit releases, imports, or real-home Departure Review activation.
