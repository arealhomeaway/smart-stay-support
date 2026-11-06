# Marketing photos: "Download all photos" (Nov 6)

STAGED, NOT APPLIED. Build and test only. Apply `01_marketing_photo_downloads.sql` only with explicit approval; undo in `undo/`.
Verify `SHA256SUMS` first. No SharePoint folders were created; tests use mocks.

## Folder convention
No per-home folder convention existed in Resolve code (only `SOPs` and the nightly backup folders). New convention, read-only:
`Documents/Homes/<street address> (<OwnerRez ID>)/Marketing Photos` in the ARHA Resolve site. Resolve never creates these folders; the onboarding team does.
Not checked: whether a `Homes` folder already exists in SharePoint (no live SharePoint call was made).

## What the SQL adds
- `marketing_photo_downloads`: one row per download (who, when, home, photo count, size); stores only a hash of the single-use, two-minute link.
- `marketing_photo_notices`: at most one "photos aren't ready" in-app notice per home per day to the home's project manager (via `notify_staff`, no email).
- RPCs `request_marketing_photo_download` (signed-in owner of that home or staff), `claim_marketing_photo_download` (single use), `notify_marketing_photos_missing`.

## Screens (code shipped, waits on this SQL)
- Staff: "Open the photos folder" on the home page and on photo plan steps.
- Owners: "Download all photos" with count and date on photo cards P07, P08, P12, P13, P14, P15 and P20. One zip, streamed photo by photo (no full zip in memory), capped at 600 photos or 3 GB. Before this SQL is applied the button reports that the download could not start.
- Replaces the "Marketing photos link" placeholder in `docs/pending/ao-cards-kati-nov5/`.
