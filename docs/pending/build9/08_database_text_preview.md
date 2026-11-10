# Build 9 G2 preview: database text without long dashes, urgency names in the vendor rule (staged only)

- Functions changed: 26

## public.request_claim_waiver
- `' — '` becomes `' · '`

## private.route_claim_waiver
- `'No eligible supervisor could be found — leadership must route this waiver.'` becomes `'No eligible supervisor could be found · leadership must route this waiver.'`

## public.decide_claim_waiver
- `'Waiver approved — Finance treatment pending'` becomes `'Waiver approved · Finance treatment pending'`
- `' — Waiver approved — Finance treatment pending'` becomes `' · Waiver approved · Finance treatment pending'`

## public.record_claim_finance_treatment
- `' — '` becomes `' · '`

## public.record_statement_disposition
- `'An estimate cannot be included — record the actual invoice'` becomes `'An estimate cannot be included. Record the actual invoice'`
- `'Documentation is incomplete — hold the expense until Operations supplies the missing facts'` becomes `'Documentation is incomplete. Hold the expense until Operations supplies the missing facts'`

## private.statement_include_authorization_guard
- `'Authorization is missing — %'` becomes `'Authorization is missing · %'`

## public.expense_review_readiness_guard
- `'This is an estimate — convert it to the actual invoice (or archive it as replaced) before Finance review'` becomes `'This is an estimate. Convert it to the actual invoice (or archive it as replaced) before Finance review'`
- `'Resolve the suspected duplicate first — mark it "Not a duplicate" or archive the duplicate entry'` becomes `'Resolve the suspected duplicate first. Mark it "Not a duplicate" or archive the duplicate entry'`
- `'Documentation is incomplete — a stored invoice or itemized receipt (and any required facts and photos) must be on record before Finance review'` becomes `'Documentation is incomplete. A stored invoice or itemized receipt (and any required facts and photos) must be on record before Finance review'`
- `'Authorization is missing — %'` becomes `'Authorization is missing · %'`

## private.expense_authorization_detail
- `'Below the supervisor approval threshold — no approval required.'` becomes `'Below the supervisor approval threshold · no approval required.'`
- `'The Work Order approval no longer covers its vendor, scope or amount — it must be re-approved.'` becomes `'The Work Order approval no longer covers its vendor, scope or amount · it must be re-approved.'`

## public.wo_candidate_after
- `' — '` becomes `' · '`

## public.decide_onboarding_financial_request
- `' — '` becomes `' · '`

## public.review_onboarding_handoff
- `'Each handoff review role signs for itself — you already passed an earlier gate on this handoff.'` becomes `'Each handoff review role signs for itself. You already passed an earlier gate on this handoff.'`

## public.record_owner_financial_response
- `' — '` becomes `' · '`

## public.review_onboarding_fact
- `' — '` becomes `' · '`

## public.prepare_work_order_owner_approval
- `'Explain the repair and proposed work for the owner in 20–4,000 characters.'` becomes `'Explain the repair and proposed work for the owner in 20 to 4,000 characters.'`
- `'Owner approval — property repair'` becomes `'Owner approval · property repair'`
- `'Owner approval — property repair'` becomes `'Owner approval · property repair'`

## private.assert_onboarding_independent_ready
- `'Financial readiness blocked: % — %'` becomes `'Financial readiness blocked: % · %'`
- `'Field readiness blocked: % — %'` becomes `'Field readiness blocked: % · %'`

## public.create_onboarding_financial_request
- `' — estimate recorded'` becomes `' · estimate recorded'`

## private.cleaner_recompute_core
- `'Elapsed time now within 10 minutes – 8 hours'` becomes `'Elapsed time now within 10 minutes · 8 hours'`

## public.cleaner_safeguard_weekly_digest
- `' enrolled STR home(s). Open states — Warning: '` becomes `' enrolled STR home(s). Open states · Warning: '`

## public.vendor_transitional_sweep
- `'All Must Pass checks are complete. Set the right Gold Standard status — nothing was changed automatically.'` becomes `'All Must Pass checks are complete. Set the right Gold Standard status · nothing was changed automatically.'`

## public.request_new_vendor
- `'No eligible vendor found — requested a new '` becomes `'No eligible vendor found · requested a new '`

## public.log_ticket_insurance_risk
- `' — flagged for supervisor visibility. No insurance action taken.'` becomes `' · flagged for supervisor visibility. No insurance action taken.'`

## public.create_departure_review_from_clean
- `'Departure Review created — departure clean completed in Breezeway'` becomes `'Departure Review created · departure clean completed in Breezeway'`

## public.expense_purchase_auth_guard
- `'Purchase authorization is missing or uncertain — record a leadership decision before allocating to the owner'` becomes `'Purchase authorization is missing or uncertain. Record a leadership decision before allocating to the owner'`

## public.wo_authorization_snapshot
- `'Change the vendor through Find a Vendor — the new vendor must accept first'` becomes `'Change the vendor through Find a Vendor. The new vendor must accept first'`
- `'The approval no longer covers this vendor, scope or amount — get it re-approved before dispatch'` becomes `'The approval no longer covers this vendor, scope or amount. Get it re-approved before dispatch'`
- `'Required approval is not in place yet — dispatch after it is approved'` becomes `'Required approval is not in place yet. Dispatch after it is approved'`

## public.notify_recovery_approval
- `'Director approval needed — guest recovery'` becomes `'Director approval needed · guest recovery'`
- `'Approval needed — guest recovery'` becomes `'Approval needed · guest recovery'`
- `' — proposed '` becomes `' · proposed '`

## private.ticket_selected_vendor_guard
- `'P1 Ticket'` becomes `'Right now Ticket'`
- `on a P2 Ticket` becomes `on a Today Ticket`
- `on a P3 Ticket` becomes `on a Routine Ticket`
