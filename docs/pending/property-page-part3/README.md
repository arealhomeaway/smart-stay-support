# Property page Part 3: staged database change (NOT applied)

Approved build: Admin, Nov 12. Additive. Apply only with the Admin's approval, in one transaction:

```
BEGIN;
\i 00_preflight.sql
\i apply.sql
COMMIT;
```

Undo (one transaction): `BEGIN; \i apply.undo.sql COMMIT;`

## What it adds
- `onboarding_projects.telegram_url`, `onboarding_projects.loa_status` (3.1 Project rows). Nullable, no backfill.
- `vendor_orgs.preferred_contact` (3.3). Nullable; nothing is guessed or backfilled.
- Two document categories, `agreement` and `estimate_invoice`, for the Agreements and Estimates and invoices folders (3.2). The constraint is rebuilt from the live definition captured in `live-capture/documents_category_chk.sql` plus the two values.
- `public.save_home_detail_field` (3.1): Telegram group and LOA status; the home's Project Manager, the Director of Onboarding or an Admin. Writes project history and audit_log (who and when).
- `public.move_home_file` (3.2): files a document into one of the five folders, never Other; the home's team, the Director of Onboarding, the Director of Operations or an Admin. Writes project history and audit_log.
- In-app notices for people who added a home to My homes (3.5): Status moves, handoff moves, and an owner message waiting on us. In the app only (email_status stays none); the person who made the change is not told.

## Until it is applied
- Telegram group and LOA status rows say the change is not applied yet and save nothing.
- Uploads into Agreements or Estimates and invoices are refused by the current category check; Move to fails with the same message. Every other folder works today.
- Preferred contact is empty for every vendor, so no contact button is marked preferred.
- Followers get no notices.

## Checks
- `00_preflight.sql` stops if the captured constraint has changed (md5 `7bf1e5ee54dc31a41ade142207766690`) or any new object already exists.
- Isolated practice run: `bun test src/lib/__tests__/property-page-part3-sql.test.ts` (PGlite, fixture `src/lib/__tests__/fixtures/property-page-part3-schema.sql`).
- `checksums.sha256` covers every file here.
