# Operations Pass 1 — Canonical Vendors + Guided Ticket

Foundation pass only. No real vendor records, no Notion import, no live dispatch automation. Stop for review afterward.

## What already exists (extend, don't duplicate)
- `vendor_orgs` (company record: contacts, markets, categories, pricing, W-9/insurance/license, tier) — 0 rows today.
- 7 gatekeeper requirements + per-vendor results, service areas (ZIP), per-property coverage, import batches/rows (Breezeway-sourced), `/vendors` page, vendor portal.
- Ticket page with a Current Action card and derived next-action logic; Work Orders linked to Tickets.

Pass 1 extends these tables and the `/vendors` page. It does not create a second vendor database.

## Conflicts to confirm (defaults I'll use unless you say otherwise)
1. **Lifecycle names.** Today: Potential / Screening / Trial / Approved / Restricted / Paused / Removed / Legacy. You asked for Candidate / Pilot / Approved / Gold / Corrective Action / Suspended. Default: replace with your six (plus Inactive for Active/Inactive), mapping Potential+Screening→Candidate, Trial→Pilot, Restricted→Corrective Action, Paused→Suspended. Safe because there are 0 vendors. Dispatchable = Pilot, Approved, Gold, Corrective Action (with supervisor sign-off, as today).
2. **Gates.** Replace the current 7 gatekeeper items with your 12 qualification gates, keeping the "failed non-negotiable gate cannot be overridden by score" rule in the database.
3. **Markets.** Fixed list OKC, Tulsa, DFW, Indy, Eufaula, Houston stored as a configurable table (not hardcoded).

## Part A — Vendor data (schema)
- Add to `vendor_orgs`: dispatch method (Breezeway / Internal Email / ARHA Staff / Setup Incomplete), Breezeway person ID (only set by verified mapping), work-order email, preference (Primary/Backup/Other per market+category), tags, source system, legacy Notion ID, migration status, Gold Standard fields (gate status, compliance status, qualification score parts + auto total, current performance score placeholder, 90-day job count, critical failure, last/next review, program owner, open corrective action + deadline).
- `vendor_market_coverage` rows: vendor × market × category × Primary/Backup — drives Directory preference and Market Coverage.
- `service_categories` config with tier Critical / Core / Specialty (critical = Plumbing, HVAC, Electrical, Locksmith/Access, Water/Fire/Sewage Mitigation, Turnover Cleaning).
- Custom fields: `vendor_custom_fields` (definition: name, type, options, order, archived) + values stored per vendor in a JSON column. System fields are defined in code and flagged protected — never renamable/deletable. "Delete" on a custom field with data = archive.
- Saved views: `vendor_saved_views` (columns, order, visibility, sort, filter, group; personal or shared).
- Every vendor change audited (who, field, old, new, when).

## Part B — Vendor workspace (`/vendors`, tabs)
- **Directory** (everyone in Operations): search + filters for market, category, preference, Gold status, active, dispatch method. Result cards like "AirWorks · HVAC · OKC · Gold · Primary · Dispatch: Breezeway · View Vendor".
- **Database** (Managers/Supervisors/Admin): spreadsheet grid — sort, filter, group, show/hide, reorder, add/rename/archive custom columns, tag options, inline edit of safe fields, bulk edit, saved views. PCs see read-only or no tab.
- **Gold Standard**: lifecycle, gates checklist, 7-part score (auto total, 85+ = eligible for paid pilot), review dates, corrective action. Advancing to Approved/Gold blocked while gates are incomplete.
- **Market Coverage**: Market × Category table with Primary, Backup, status (Missing Primary / Missing Backup / Complete), critical categories highlighted.
- **Needs Review**: migration staging queue.
- **Vendor Profile** page: Contact, Coverage, Services, Dispatch Setup, Gold Standard, Compliance, Pricing, Notes/Documents, Recent Work Orders, Properties Served, Performance placeholder; actions Edit Vendor and View Market Coverage. Registered in shell nav with Back.

## Part C — Notion migration staging
- Extend import rows with `source_system = notion`, full raw row kept, unknown columns preserved as legacy metadata.
- Review states: Ready to Import, Possible Duplicate, Missing Contact Info, Missing Market, Missing Service Category, Needs Dispatch Setup, Inactive/Archive Candidate — computed on staging.
- Duplicates flagged by normalized name/phone/email/website, never auto-merged.
- Notion "In Breezeway" stored as an unverified hint only; state Needs Dispatch Setup until a real Breezeway ID is mapped.
- CSV upload UI ready; not run against the live Notion export.

## Part D — Guided Ticket
- Derived guidance stage over existing statuses: Needs Acknowledgment → Needs Decision → Needs Action → Waiting → Needs Follow-Up → Ready to Close → Closed. Pure function, unit-tested; history untouched.
- One **Next Action** panel at a time; completed steps collapse into history.
- Active guest stay shown automatically from the existing OwnerRez data (guest, dates, channel); occupancy is never asked.
- Guest update step ("What did you tell the guest?" → Save Guest Update & Continue) when a stay is active.
- Resolution decision in plain language: Try to solve this with the guest / Send someone to the property / Escalate to a supervisor / Issue already resolved.
- Troubleshooting framework: configurable playbooks by issue category, one step at a time, answers saved, "Still not fixed — send someone" transition. Reuses existing playbooks tables; no new ARHA playbooks authored.
- Field support: "Choose who should handle this" — vendor picker from the Directory filtered by the Ticket's market/category, showing market, category, Gold status, preference, dispatch method. Selection is recorded on the Ticket; Work Order creation uses the existing engine only as it works today (no new dispatch).
- Ticket = the problem, Work Order = field action shown nested under the Ticket.
- Waiting panel: "Waiting on …" + "What happens next" + Next Guest Update Due.
- Close guidance: "Ready to Close — N items remaining" listing summary, guest update, linked Work Order, evidence, open dependencies; Close shown only when clear. Existing closure gates stay authoritative.

## Permissions (server + database)
- Admin: everything. Managers/Supervisors: Database tab, custom fields, saved shared views, tags, safe bulk edit. PCs: Directory + Profile read, vendor picker on Tickets.
- Gold Standard / compliance changes: Admin, Director of Operations, supervisors.
- Protected system fields rejected server-side for non-admins. Ticket permissions unchanged.

## Deferred to Pass 2
Google sourcing, automatic performance scoring, callback intelligence, live Notion import, Breezeway ID reconciliation, Vendor → Breezeway / Email Work Order dispatch, performance-review history migration.

## QA
Synthetic demo vendors only, then removed. All vendor and ticket checks from your list, plus full automated test suite.

## Technical notes
- Migrations extend `vendor_orgs`, `gatekeeper_requirements`, `vendor_import_rows`; new tables `vendor_markets`, `vendor_service_categories`, `vendor_market_coverage`, `vendor_custom_fields`, `vendor_saved_views`, `vendor_field_audit` with GRANTs + RLS using `has_role`/`is_supervisor`/`is_director`.
- Writes through RPCs/server fns (`src/lib/vendors.functions.ts`); protected-field list shared in `src/lib/vendors.ts`.
- Guidance stage in `src/lib/ticket-guidance.ts`; Ticket page refactor keeps the two "start working" anchor points and existing tests.
