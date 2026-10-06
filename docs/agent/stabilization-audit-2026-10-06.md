# Stabilization & change audit — 2026-10-06 (read-only)

Scope: Emily's stabilization request (Oct 6, 19:01 UTC). No code, schema, real-record, seat, notification or publish changes were made in this pass. Evidence = direct database reads, live-site bundle inspection, git history, chat history.

## 1. Linder / 1399 Foxtail — immediate diagnosis

Stored facts (read 2026-10-06 ~19:05 UTC):

| Fact | Value |
|---|---|
| Program | `579cb6ae…` status **draft**, `started_on` NULL, `ends_on` NULL, `dfy_confirmed` false, not demo, not archived |
| Canonical owner | `property_owners 4f802d41…` (Matt & Shannon Linder), active |
| Account link | `owner_user_id` = Matthew Linder `bc62d95a…`, role `owner` only |
| Enrollment | 1399 Foxtail Ln. included, `closing_confirmed` true, `closing_date` **2026-10-06** (confirmed by Emily 16:08 UTC) |
| `properties.actual_closing_on` | **NULL** (second closing field not populated — two sources of closing truth) |
| Day one | **Nothing stored.** 09/30 was only a value in the activation form; it was never saved |
| Hours logged | 0 |
| Program history | program_created (Emily) → closing_confirmed (Emily) → owner_linked |

Blockers, in order:

1. **Program not active** — `private.lock_owner_time_program` (called by `log_owner_time_entry`) rejects any owner entry unless status is active/target_reached and `started_on` is set. This is the actual reason the Linders cannot log.
2. **DFY gate** — `public.activate_owner_program` raises "Confirm with DFY that these properties run as one combined program first." when `dfy_confirmed` is false. UI echoes it in `OwnerProgramActivation.tsx` and `owner-programs.tsx` copy.
3. **Separate start date ("Day one")** — the same function requires a staff-entered `_started_on` that is ≤ today and ≥ every included closing. 09/30 < 10/06 closing would be refused; today (10/06) is the only date it would accept.

Provenance:
- DFY gate and single program start date: from Emily's Aug 21 2026 brief (chat #126, "Confirm with DFY that the properties are included in one combined program… Activate one 90-day start date"). Columns added 2026-08-21 (`supabase/migrations/20260821143055…`); RPC enforcement 2026-09-16 (`20260916040000_atomic_owner_program_activation.sql`), restated in drizzle 0051/0052.
- Sep 23 V2 corrections (mem: v2-architecture-corrections #9) replaced the 90-day window with closing → Dec 31 and removed hour approval. The implementation changed the end date (`ends_on` = Dec 31 of start year) but **left the DFY gate and the staff-entered start date in place**. No instruction retired DFY until today. This was an implementation omission, not an approved rule.
- Leftover 90-day text still in the activation event (`summary '90-day participation program activated'`, `endsOn = start+89`).

Already correct (no change needed): `log_owner_time_entry` enforces property-specific eligibility — each linked home must have a confirmed closing on/before the entry date. Hours are inserted as `submitted` with no approval step.

Smallest correction (proposed, not applied):
- Migration replacing `activate_owner_program`: drop the DFY check; set `started_on` = earliest included confirmed closing (no separate Day one input); `ends_on` = Dec 31 of that year; fix event wording. Keep all other guards (role, version, canonical owner, demo match, no clock reset).
- UI: remove DFY requirement text and the Day one field from the activation dialog; keep DFY as an optional informational checkbox (or remove — business choice) in Program setup.
- Then Emily activates Foxtail through the normal button (audited, attributed to her). Linders can log hours dated 10/06 onward.
- No change to closing date, account, link, hours, reports or history.

Audit-history disclosure: the Linder account link earlier today was performed by the assistant through a privileged database call (invite `LINDER1399` created as Emily, redeemed for Matthew), not by Matthew through `/join`. The resulting event reads "Homeowner connected their account with an invite code", attributed to Matthew. The link itself is correct and authorized by Emily's request, but the attribution is inaccurate. Proposed: append a staff correction note to program history (no edit/deletion).

Suspected gap: per-property "through Dec 31 of the closing year" is not enforced at logging (lock checks start, not `ends_on`); a home closing in a later year in the same program would share the first year's end date.

## 2. What is deployed

- Project: Resolve (this repository). Latest saved revision `3ac7b1dd` — 2026-10-06 16:06 UTC "Hidden withdrawn items".
- Live URL https://smart-stay-support.lovable.app is published (public). Live code contains changes saved through **at least 2026-10-06 14:43 UTC** (`a577f240`, "Make these stages editable"; also the #24 Download control from 14:37, Claims Closed/Unsettled, invoice date, Statement Readiness, Owner completions to review, Log Property Activity, guest-feedback "Historical import only"). The last publish the assistant recorded was Sep 29 (#15). So someone published today after 14:43 — prior "not published" statements were wrong for the current live site.
- Unverified: whether the 16:06 server-side change (withdrawn approvals hidden from the homeowner list) is live; it is not detectable from browser code.
- Preview and live share **one** backend: same database, file storage, sign-in accounts and backend functions. Every database migration (drizzle 0055–0134 since Sep 26) took effect for real staff and homeowners the moment it was applied, regardless of publishing.
- Real-record changes made directly today: three Foxtail approvals withdrawn (cancelled, history kept); Linder account linked; Foxtail closing confirmed by Emily.

## 3. Change audit (Sep 26 – Oct 6)

All rows below are LIVE (shared database). Frontend items are live as of today's publish. "Verified" reflects what was actually run.

| Date | Change (migrations) | Workflow | Requirement source | Behavior / permission | Verification (role) | Known gaps |
|---|---|---|---|---|---|---|
| 09-28 | 0055–0058 | Onboarding templates, access | Emily onboarding passes | Owner-dependency taxonomy; program rules/avatars/demo env narrowed to staff/admin | Unit/SQL tests | — |
| 09-29 | 0059–0061, 0079–0081 | Owner⇄ARHA threads | Emily: append-only threads | New `owner_request_messages`; owner read via ownership check; resolve requires staff | Synthetic owner + staff | — |
| 09-29 | 0062–0077 | STR cleaner safeguard | Emily safeguard spec | New internal-only tables/cron | Synthetic only | — |
| 09-30 | 0082–0092 | Vendors | Vendor launch spec | Compliance gates, Transitional Review, Emergency Only lock | SQL tests | Vendor-safe Ticket view missing |
| 10-02 | 0093–0101 | Ops entry, guest feedback, departures | Ops passes 2–5 | Guest-impact fields, `guest_feedback`, departure matching | Synthetic, admin + ops | 3 Ops browser checks open |
| 10-02 | 0102–0104 | Finance | Approved Finance foundation | `expenses`, internal attachments, archive guard | Synthetic Finance | — |
| 10-02 | 0105–0106, 0110 | Vendor dispatch | Vendor execution spec | Telegram confirmation + current authorization before handoff | SQL | Telegram confirmations pending |
| 10-02 | 0107–0109 | Onboarding notifications | Kati #21 | Follows, recipient/scope checks | Synthetic alerts | #21 awaits Kati |
| 10-05 | 0111, 0113 | Demo owner link | Emily | Admin-only demo linking | Synthetic | — |
| 10-05 | 0112, 0127 | Owner Opportunities | Emily | Archived/retired Opportunities hidden from owners | Synthetic owner | — |
| 10-05 | 0114, 0125–0126, 0128 | Owner completions / fresh requests | Kati #22, Emily | Owner complete RPC; staff completion review; explicit response requests | Synthetic owner + staff | — |
| 10-05 | 0115 | Ops read of completed onboarding | Emily handoff test | Staff read-only access to completed onboarding files | Synthetic Ops | **Synthetic onboarding account could open a real-home file** (scope risk) |
| 10-05 | 0116–0124, 0129–0131 | Claims, Statement Readiness, expense evidence/authorization | Emily Claims/Finance specs | Gates, waivers, sign-off rules, evidence re-review | Synthetic non-admin Finance | Finance acceptance closed; James own-account pending |
| 10-05 | 0132 | Vendors | Emily | Vendors cannot read internal Ticket activity | SQL read check | — |
| 10-05 | 0133–0134 | Spending approvals | Emily: Ops Supervisor/Director Ops only | Generic manager/admin/Finance no longer approve spending | Synthetic | Real seat impact not reviewed with staff |

Not traceable to an approved instruction (assistant/implementation assumptions):
- DFY activation gate and staff-entered start date surviving V2 (see §1).
- 90-day wording in activation history.
- No migration since Sep 26 changed activation or hour logging; the Linder blocker pre-dates the recent passes.

## 4. Help & Feedback reconciliation

No new or reopened tickets since #27. No Iveth or homeowner-portal tickets open (Iveth: 1 resolved; Active Owner staff: 1 resolved).

| # | Reporter | Symptom | Status | Related change | Evidence |
|---|---|---|---|---|---|
| 18 | Emily | Routine work photo field should be upload + Breezeway link | new | none | Not started |
| 19 | Emily | Check-out step unnecessary | new | none | Not started |
| 20 | Kati | Assessments in property details | resolved | Assessments & Forms directory | Admin/synthetic only |
| 21 | Kati | No updates when owner responds / task completed | reviewing | 0107–0109 | Synthetic alerts passed; awaiting Kati |
| 22 | Kati | Review process for owner completions | resolved | 0125–0126 | Synthetic |
| 23 | Kati | Hub order | resolved | UI | Browser (admin) |
| 24 | Kati | Cannot open homeowner fence PDF (9211 Fitzgerald) | new | Download/Open control (14:37), now live | File exists (135 KB, owner upload Oct 1). **Not verified with Kati's own onboarding account.** |
| 25 | Kati | Add "Needs My Attention" to hub | new | none | Layout decision |
| 26 | Kati | Task view options; what is Module | new | none | Suggestion; explanation drafted |
| 27 | Kati | Cannot edit section titles / drag tasks | new | "Make these stages editable" (14:43), now live | Not verified with Kati's account; no real template changed |

## 5. End-to-end reproduction status

| Sequence | First failure | Evidence |
|---|---|---|
| Staff sets up property + links owner | **Activation blocked by DFY gate / Day one** | Real-record read + function source |
| Owner logs hours | Blocked by inactive program | `lock_owner_time_program` |
| Owner replies/uploads; onboarding staff opens after completion | Not re-run this pass | Prior: UI lacked control (fixed); non-admin click-through never completed |
| Staff notification → exact record | Not re-run | Prior synthetic pass (#21) |
| Owner navigation back/return | **Not tested** | — |
| Kati's broken workflows (#24, #27) | Not tested with onboarding role | — |

Remaining sequences need a synthetic onboarding account scoped to a demo home and a synthetic owner on a demo program (no real accounts).

## 6. Recovery plan

A. Linders (confirmed defect) — replace activation rule (§1), UI cleanup, Emily activates normally, add attribution correction note. Validate with a demo program first (activate → owner logs → report shows hours), then Foxtail. Releases as a database change + small UI change; no Ops/vendor code involved.

B. Owner-submitted documents (fixed-and-live, unverified) — verify #24 with a synthetic onboarding account on a demo home; decide policy on demo accounts reading real-home files (suspected scope defect from 0115/existing policy).

C. Return navigation (unverified) — browser walk: owner Dashboard → Opportunities → detail → back; participation/report → back; record failures.

D. Remaining — #27 verify; #25/#26 business decisions; roadmap acceptance items stay paused. Vendor features remain gated (vendor login disabled), so publishing A–C does not expose unfinished vendor work; Ops changes already live today.

Business decisions needed: keep DFY as optional record or remove; whether `properties.actual_closing_on` or enrollment closing is the single closing truth; per-property year-end handling for multi-year programs.
