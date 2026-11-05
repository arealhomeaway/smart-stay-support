# Availability Finder v2: lead offers — pending

Status: staged only, NOT applied. Approved for build by Emily, Nov 5 2026 (part 2 of the Availability Finder changes).

## What this is

Part 2 links the Availability Finder to Leads. "Offer this property" creates a lead when none is attached (who-details all optional) and records the offer with the quote total snapshot. Each lead carries a list of offers with outcomes (Waiting, Declined with reason, Accepted). Accepting an offer marks the lead Booked on that home. "Choose another property" reopens the finder with the lead's search pre-filled and skips every home already offered.

## Files

- `01_lead_offers.sql` — new nullable columns on `leads` (search_region, desired_check_out, guests, dogs, cats, inquiry_source_id, next_follow_up_on) and on `lead_properties` (quote_total, quote_currency, outcome, outcome_reason, outcome_at, outcome_by), plus the outcome check constraint. Makes `leads.contact_name` nullable (DROP NOT NULL — will ask for confirmation at apply time).
- `01_undo_lead_offers.sql` — full undo. Finder-created leads with no contact name get the placeholder "Not recorded" first so the restore cannot fail.
- `sha256.txt` — checksums, verified before any apply.

## Apply order (Emily approves)

1. Verify checksums against `sha256.txt`.
2. Apply `01_lead_offers.sql` exactly as written.
3. Publish the app (the offer writes and the Offers section need these columns).

Undo: run `01_undo_lead_offers.sql`.

## What does not need this SQL

Part 1 (tab move, guests filter, ranking, one-at-a-time cards, Corporate Housing Extra removal) is code only and works without this file.

## Behavior before apply

Until this SQL is applied, the Leads list and workspace render without the offer columns (a muted note says offers appear once the update is applied), and saving an offer from the finder fails with a clear error. No existing screen breaks.
