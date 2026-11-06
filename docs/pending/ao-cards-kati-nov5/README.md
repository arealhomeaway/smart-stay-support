# Active Owner card and plan updates from Kati's review (Nov 6)

STAGED, NOT APPLIED. Approved by Emily for build and test only. Apply each file only with a separate explicit approval.
No owner is messaged. No in-progress home's plan changes. Template push to in-progress homes stays paused.

## Files (apply in this order, verify `SHA256SUMS` first)
1. `01_standard_template.sql`: Standard template working rows, then publishes Standard **version 2** with the same snapshot `publish_onboarding_template` writes. Version 1 is immutable and untouched.
2. `02_card_library.sql`: card edits as new card versions with history (same effect as `ao_card_save` / `ao_card_set_status`), two new Draft cards, P19/P20 suggestion decisions, and the placeholder column. Needs file 1 first (new step IDs).
3. `03_release_new_cards.sql`: separate approval. Releases A58 and A59. Until then they are Draft and reach no home.
Undo for each is in `undo/`. `live-capture/` holds the read-only snapshot used for undo. Each file stops with "nothing applied" if a card or step changed since capture.

## What changes
| # | Item | Change |
|---|------|--------|
| 1 | A15 | Set to Draft. Nothing in the Standard template links to it (only a rejected Owner Task Template mapping). |
| 2 | New step "Upload the floor plans" | Pre-Close, sort 385 (before A26's step at 750), Lead Designer. Review setting: lead designer reviews when someone else completes it (existing step-review rule; the reviewer is the home's Project Team lead designer). A26 now unlocks from this step and the homeowner sees the floor plan files shared on it. |
| 3 | New step "Upload the furnishing breakdown and make-ready estimate" + new card **A58** "Review your furnishing breakdown and payment schedule" | Step at 755, same role as the Accounting step. Its checklist carries the invoice request to Accounting and the existing email instructions; the separate "Send the invoice request to Accounting" step is retired from version 2 so it is not done twice. A58 unlocks when this step is done and shows both shared files, with acknowledge and a question box. Text is generic; no Buckland amounts copied. |
| 4 | A41 | Draft, note "Replaced by Review your furnishing breakdown and payment schedule until revised." |
| 5 | A31 | Same handoff meeting as the plan's handoff, an invitation to attend. |
| 6 | A35 | Points to the monthly owner statement the owner already receives. |
| 7 | A56 | Optional, after go-live (`operations`, flexible lane). |
| 8 | A57 | Hours already log before closing (no gate in `ao_submit_card` or hours eligibility). Fix: it had no linked step, so it could only be unlocked by hand; now unlocks when "Hold the Owner readiness call" is done. |
| 9 | N10 | Unchanged (opt-in, no N/A). |
| 10 | P03, P04 | Choose from ARHA's approved standards list within the furnishing budget. |
| 11 | P14, P15 | Text points to a Marketing photos link in the ARHA Resolve SharePoint site. Placeholder column `ao_home_plan_cards.marketing_photos_link`, nothing reads or writes it yet. |
| 12 | P19, P20 | Already have no linked step; pending link suggestions are rejected so they stay card-only. "Share the guest instructions with the Active Owner" (linked its owner opportunity "Review your home's guest instructions"; blocked handoff; Project Manager) is retired from version 2 and becomes new Draft card **A59** with the same owner text. |

## Who is affected
- Released home plan cards keep their pinned card version; no home has any of these cards yet (0 plan cards today).
- Only **624 Daniel Court** is on Standard version 1 and keeps it. It would change only if template push to in-progress homes resumes. All other active homes use other templates.
- New homes started on Standard after file 1 get version 2.

## Decisions made for you (please confirm)
- The Accounting request is a checklist item on the upload step, not an automatic Finance record: the existing Finance request record requires an amount and approval tier and is meant for spending approval, so reusing it would misfile invoice prep.
- Retiring the guest-instructions step removes one handoff-blocking step from version 2.

## Code shipped with this package
Homeowner cards now show files staff shared on the card's linked step (`cardFilesByReview` in `src/lib/owner-onboarding.server.ts`). Safe before the SQL: it only reads.
