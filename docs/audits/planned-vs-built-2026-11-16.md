# Planned vs built, Nov 16 2026

Read only. Nothing was changed to make this report.

## What was checked

The decision register, open roadmap items, the Nov 9 and Nov 10 status reports, the current plan and the Nov 4 Operations plan (the only plan from Nov 1 on), the pending folders and their notes, code searches, migrations through 0343, live switches, selected live functions and the change log. Live means current code and live database. The published app and signed-in screens were not checked. The scheduled job list could not be read with this account.

This is a verified partial list, not a full sign-off. Not every one of the 146 pending folders was compared object by object with the live database.

## Operations

| Item | Where decided | Status | What is missing |
|---|---|---|---|
| Mid-term bookings get a three-month extension block. | `docs/decision-register.md:76`; `docs/pending/register-status-nov10.md:132` | Not built | Nothing matching found in the code. |
| Breezeway approvals write back to Breezeway. | `roadmap.md:565` | Not built | Roadmap says researched, not built. |

## Onboarding

| Item | Where decided | Status | What is missing |
|---|---|---|---|
| Staff can return one Task to its automatic due date. | `roadmap.md:553` | Not built | Roadmap calls this follow-up not built. No matching action found. |
| The second PID refresh fills approved missing home details. | `docs/decision-register.md:135`; `docs/pending/pid-refresh-2026-11-12/README.md:3-4` | Staged, not applied | Not applied as a package. The nightly PID sync has since filled many of the same fields; a field by field comparison was not done. |

## Active Owner

No open gap was found with enough evidence to list. The 10 homeowner cards with no live Task were marked already covered on Nov 16 (migration 0343), and the plan-ready email resend was sent on Nov 13.

## Finance

| Item | Where decided | Status | What is missing |
|---|---|---|---|
| Vendor invoices follow an approval and payment flow. | `docs/decision-register.md:72`; `docs/pending/register-status-nov10.md:129` | Partly built | Files attach. Bill To choices, Supervisor approval and Finance payment recording were missing. Full flow not rechecked. |
| Ramp purchases become linked Expense records. | `docs/decision-register.md:77` | Not built | No Ramp intake found. |
| Finance gets the incomplete Ramp queue and cutoff checks. | `docs/decision-register.md:77` | Not built | No queue or cutoff found. |
| Every money record needs a reason. | `docs/decision-register.md:78`; `docs/pending/register-status-nov10.md:134` | Partly built | Ready checks and fields exist; a required reason on every write was not found. |
| Finance gets month-end owner statement data per home. | `docs/decision-register.md:78` | Not built | Nothing matching found. |
| Finance gets its own account type. | `docs/decision-register.md:23`, `:115` | Partly built | Finance access works through roles; account types are still the six in `src/lib/permissions.ts:17-25`. |

## Admin and platform

| Item | Where decided | Status | What is missing |
|---|---|---|---|
| Admin can update several Help tickets in one save. | `docs/pending/help-tickets-bulk/README.md:1-7` | Staged, not applied | The three database functions are not live. |
| Director and Utilities get their own account types. | `docs/decision-register.md:23` | Partly built | Roles exist; account types are still the six in `src/lib/permissions.ts:17-25`. |
| Reports offers nine ready-made reports and a personal report builder. | `docs/decision-register.md:125` | Not built | No Reports page or builder found. |
| Logic and Automations shows the rules settings in one page. | `docs/decision-register.md:126` | Partly built | Settings exist; no single page found. |
| Company and CEO dashboards show the planned company measures. | `docs/decision-register.md:124` | Not built | Not found. |
| Analytics shows all six planned role views on one page. | `docs/decision-register.md:123` | Partly built | Analytics and My scorecard exist; all six views not checked. |
| The new nightly export code is published before the Sunday run. | `roadmap.md:718-719` | Partly built | Database part is live (migration 0342). The app code needs publishing before Sun Nov 22, 2 AM Central. |

## Live switches to know about

These are on in the live database, though project notes say they stay off until Emily turns each on after a test: `email_intake`, `breezeway_bridge`, `arrival_checks`, `onboarding_breezeway_send`, `vendor_portal`. Also on: `onboarding_external_sync`, `onboarding_sharepoint_docs`, `pid_nightly_sync`. Off: `owner_alerts`, `internal_work_orders`, `arrival_ready_button`, `finance_packet_button`, `imported_tickets_page`. A switch being on does not prove the feature is working.

## Staged folders not applied

| Folder | What it does | Why it waits |
|---|---|---|
| `docs/pending/help-tickets-bulk/` | Saves grouped Help ticket changes with optional grouped notices. | Needs its own approval; functions not live. |
| `docs/pending/pid-refresh-2026-11-12/` | Fills and updates home details from the PID refresh. | Earlier apply attempt stopped (read-only connection); no apply record. |

Many folders still headed "pending" are in fact applied (migrations or change-log rows exist), including property page Parts 1 to 3, Onboarding Home, Plan catch-up, enrollment start, PID nightly sync, the upcoming-access fix, Move to queue and the export alert. A folder heading alone is not proof.

## Decided against or replaced

- Notion two-way sync: replaced by a one-time import, Resolve is the record (`docs/decision-register.md:12`, `:93`).
- Work orders made in Resolve: replaced by Breezeway work orders (`docs/decision-register.md:147`).
- Queue sweep button: replaced by automatic checks when the Supervisor opens the queue (`docs/decision-register.md:121`).
- Friday finance packet and its Home button: retired (`docs/decision-register.md:121`).
- Ready for arrival button: replaced by the arrival check queue (`docs/decision-register.md:121`).
- Earlier bonus timing and scoring: replaced by the BN rules and bonus guide values (`docs/decision-register.md:158`, `:169`).
- Pay dates and "Pays on" wording: removed by BN12 (`docs/decision-register.md:170`).
- Long dashes for empty values: blocked by the wording rule (`roadmap.md:80`; `docs/decision-register.md:7`).

## Totals

| Status | Rows |
|---|---:|
| Built but switched off | 0 |
| Staged, not applied | 2 |
| Partly built | 7 |
| Not built | 8 |
| **Listed** | **17** |
