# Vendor Management, Sourcing, Scheduling & Performance

Phase 1 deliverable: audit, architecture, migration map, and phased build plan. No schema or UI changes yet.

## 1. What already exists and gets reused

| Need | Already in Resolve | Verdict |
| --- | --- | --- |
| Vendor identity | `app_role = vendor` on a user, `tickets.vendor_user_id` | Reuse for people. **No company entity exists** — this is the central gap. |
| Vendor portal | `/vendor`, `/vendor/$ticketId`, `/vendor/scorecard`, `VendorDispatchPanel`, `JobMap`, `VisitCheckInCard` | Reuse and extend; do not rebuild. |
| Dispatch ranking | `src/lib/dispatch.ts` (distance + tier + load) | Reuse; add coverage-map priority ahead of distance. |
| Scorecard + gamification | `vendor_job_ratings`, `src/lib/scorecard.ts`, tiers, Gold Standard, anonymous percentile | Reuse the private-scoring philosophy; add company rollup, sample size, and the 100-point gatekeeper/trial model. |
| Checklists + evidence | `playbooks`, `playbook_steps`, `ticket_steps` (`required`, `photo_required`), `ticket_activity` | Reuse as the vendor checklist engine. No second checklist system. |
| Arrival / completion | `ticket_visits` with geo-verified check-in/out | Reuse as calendar arrival truth. |
| Properties + geo | `properties` (lat/lng, geocode), `owner_sees_property` | Reuse; add coverage mapping on top. |
| Notion | `src/lib/notion.server.ts`, `notion-sync.server.ts`, field-conflict queue, `NotionSyncPanel` | Reuse the exact mirror + conflict pattern for vendors. |
| Cross-system IDs | `external_links` (entity_type/system/external_id) | Reuse as-is for Notion / Breezeway / Google Place IDs. Nothing new needed. |
| Staging + conflicts | `integration_events`, `field_conflicts` | Reuse for migration staging telemetry. |
| Documents | `documents` table (entity_type/entity_id, visibility, expiry-ish fields) | Reuse for contracts/COI/W-9. Add restricted identity handling. |
| Approvals | `approvals` (kind, amount, approver, decision) | Reuse for over-limit additional work and trial/status approvals. |
| Coach | `src/lib/coach.server.ts` + `coach-field-notes.ts` | Extend with Vendor Sourcing Mode. No second coach. |
| Notifications | `owner_notifications` + `email.server.ts` (Microsoft Graph, `email_log`, retries) | Generalize the notification row into a shared queue; email transport is already built. |
| Audit | `audit_log`, `is_platform_owner/is_supervisor/is_staff` helpers | Reuse for every status change, merge, and restricted-doc view. |
| Google | Google Maps connector already linked (`geo.server.ts` gateway pattern) | Reuse the same gateway for Places. No new key needed. |
| Calendar | **Nothing** | Net-new. |

**Real gaps:** vendor organization, vendor team tenancy + masking, coverage map, migration staging, gatekeeper config, calendar/scheduling, notification queue, restricted document vault.

## 2. Proposed schema additions

Company and people
- `vendor_orgs` — internal ID, legal + display name, `vendor_class`, `status`, contacts, website, service categories, markets, capacity, response time, emergency availability, pricing/terms, insurance & license & W-9 status + expirations, tier, score, last verified. External IDs live in `external_links`, not columns.
- `vendor_org_members` — user ↔ org, `vendor_role` (admin / dispatcher / team_member), **`masked_code`** (e.g. `MM-014`), active flag, attestation reference. ARHA-facing views select `masked_code`, never the profile name.
- `vendor_contacts` — non-login contacts (legacy Breezeway Representatives land here first).
- `vendor_status_events` — every status change with actor, reason, timestamp. Status cannot change without one.
- `vendor_attestations` — the subcontractor/insurance/confidentiality attestation, per admin, versioned.

Coverage and scheduling
- `property_vendor_coverage` — property × service category × priority (primary/backup/emergency/recurring), effective dates, rate ref, checklist ref, approval limit, access requirements, last verified.
- `vendor_assignments` — the calendar event: property, vendor org, optional ticket, service category, required arrival/completion window, assigned member, status (scheduled → accepted → in_progress → completed / missed / canceled / needs_reassignment), recurrence parent, timezone.
- `vendor_schedule_changes` — requested-by, old/new window, approval state. Vendors request; ARHA approves.
- `vendor_recurrences` — weekly / biweekly / monthly / quarterly / seasonal / reservation-triggered / custom.

Sourcing, screening, performance
- `vendor_candidates` — sourcing pipeline (Google Place ID, rating, review count, refreshed_at, ARHA status, referral notes, references).
- `vendor_references` — reference checks with verifier and outcome.
- `gatekeeper_requirements` — configurable by vendor class / category / market / risk: required | optional | blocking | n/a, verification method, approver, expiry.
- `vendor_gatekeeper_results` — Verified & Meets / Verified & Does Not Meet / Not Verified / N/A. "Not Verified" never passes.
- `vendor_performance_events` — no-show, late, rework, complaint, damage, unauthorized spend, critical failure, plus the positives. Scorecard is derived from these, never hand-edited.
- `vendor_achievements` + `vendor_score_weights` — weights are **rows, not constants**, so leadership tunes the 30/20/15/10/10/10/5 model without a deploy.

Migration and documents
- `vendor_import_batches` + `vendor_import_rows` — staging with raw payload, proposed action (create / match / merge / skip / needs_review / archive_legacy), match candidates + confidence, reviewer, decision. Nothing reaches `vendor_orgs` except through an approved row.
- `vendor_documents` — extends `documents` with `restricted boolean`, `doc_type`, expiry, verifier. Restricted rows live in a **private** storage bucket, served only via short-lived signed URLs, and every view writes to `audit_log`.

## 3. Source-of-truth and sync

- **Notion → Resolve (read):** approved company records, official status, final gatekeeper results, contracts/policy, categories, approved markets, executive restrictions. Mirrored the same way properties are today — differences raise a `field_conflicts` row; Resolve never silently overwrites.
- **Resolve → Notion (write, summary only):** approved vendor summary, current status, tier, score, last review date. Nothing operational (checklists, photos, worker identity) leaves Resolve.
- **Breezeway:** one-way legacy import into staging only. Departments become legacy service categories; groups become legacy market hints; "All Groups" is recorded as a legacy permission and explicitly **not** market approval. 2FA/invite state is legacy metadata excluded from scoring.
- **Google Places:** sourcing signal only. Cached with `refreshed_at`, attribution shown, Place ID stored, restricted fields refreshed on the required cadence. Never sets ARHA status.
- **Documents/invoices/price sheets:** supporting evidence. Filename-vs-document-name mismatch → flagged for review, never auto-assigned.

## 4. Breezeway migration map (from the screenshots)

| Breezeway | Resolve |
| --- | --- |
| Role = Service Provider | Candidate `vendor_orgs` row, status **Potential**, `external_links` system=`breezeway` |
| Role = Representative | `vendor_contacts` row; linked to an org only on evidence (company name, email domain, Notion, docs, manual confirm) |
| Representative with no defensible link | "Unmatched Legacy Representative" queue |
| Departments (Cleaning / Inspection / Maintenance) | Legacy service categories |
| Groups (Edmond, Magnolia TX, McCordsville IN…) | Legacy market hints requiring verification |
| "All Groups" | Legacy permission flag only |
| 2FA / Pending Invitation | Legacy account metadata, excluded from scoring |

Personal-gmail Representatives (e.g. `beckymichalec371@gmail.com`) will **not** be auto-promoted to companies. Domain-bearing ones (`andrew@airworksokc.com`, `info@allaspecthandyman.com`) are proposed matches a human confirms. Duplicate detection runs on company name, contact name, email, phone, website domain, Notion ID, Breezeway ID, Google Place ID. Nothing imports as Approved.

## 5. Vendor tenancy and masking

Row-level security keys off `vendor_org_members`, via new security-definer helpers mirroring `has_role`: `vendor_org_of(user)`, `is_vendor_admin(user, org)`, `is_vendor_member(user, org)`.

- Vendor Admin / Dispatcher: only their org's rows.
- Vendor Team Member: only assignments where they are the assigned member.
- ARHA operational views read `masked_code` + vendor org. Worker real names are not selectable by ARHA roles at the policy level — masking is enforced in the database, not the component.
- Platform Owner incident unmasking is a separate logged action requiring a written justification, writing to `audit_log`.
- Vendors see no other vendor, no owner/guest data, no financials, no analytics, no unrelated property.

## 6. Restricted documents

Private bucket, no public URLs. Signed links expire in minutes. Standard vendor profile shows only: identity document on file, verification status, verified date, expiry, authorized verifier. License numbers, DOB, home address, descriptions, signatures, and images are never selected into general views, exports, search, scorecards, notifications, analytics, or coach context. Coach prompts are built from an allowlist of fields, so restricted data cannot leak by omission.

## 7. Calendar architecture

One `vendor_assignments` table drives every view: month / week / day / agenda / mobile today, scoped as property, vendor-company, worker, or global ARHA calendar. Times stored UTC, rendered in the property's local timezone. Global filters: market, property, vendor, category, masked worker, status, date range. Drag-to-reschedule opens a confirmation and writes an audit entry; a vendor's drag creates a *request*, not a change. Overlap detection per worker and per vendor; same-day turnovers flagged. Approved changes are never performance failures; misses and unauthorized lateness create `vendor_performance_events`.

## 8. Google Places

Server-only, through the already-linked Google Maps connector gateway (same pattern as `geo.server.ts` — no new secret). Text/nearby search by category, city, ZIP, property radius, open-now, emergency keywords, min rating, min reviews. Gate defaults: ≥4.0 and ≥20 reviews; 5–19 reviews needs stronger references + controlled trial; <5 or no profile needs a trusted referral, two references, and a trial; <4.0 needs a documented executive exception. Ratings never approve anyone. No scraping of search pages.

## 9. Scorecard and gatekeeper

Trial vendors are scored on the configurable 100-point model (weights stored as rows, defaults 30/20/15/10/10/10/5). Thresholds 90+/80+/70+/<70 are configuration too. ARHA Stars = score ÷ 20; four stars requires ≥80, all blocking gatekeeper items passed, and no unresolved critical incident. Ongoing scorecard is computed from `vendor_performance_events` with **sample size always displayed** and a minimum-jobs floor before ranking. Google reputation is shown in a visually separate block from ARHA performance. Critical failures trigger immediate review regardless of average. Achievements are company-level, sample-gated, and suspended when performance drops.

## 10. Phasing

1. **This document** — audit and approval.
2. **Foundation** — vendor orgs, contacts, status events, coverage map, documents, gatekeeper config, RLS, migration staging + Breezeway/Notion import review.
3. **Teams & portal** — vendor roles, vendor-managed invites (reusing `team_invites`), masked IDs, attestation, checklist workflow.
4. **Calendar & notifications** — assignments, recurrence, conflicts, change approvals, shared notification queue.
5. **Sourcing coach** — Vendor Sourcing Mode, Places, candidate pipeline, screening, trial.
6. **Scorecards & gamification** — performance events wired to tasks, single-market pilot, weight validation, then gamification on leadership approval.

## 11. Decisions ARHA needs to make

1. **Masked worker codes** — auto-generate as `{ORG_INITIALS}-{seq}` (e.g. `MM-014`), or let each vendor set their own?
2. **Existing vendor users** — the vendor logins already in Resolve need to be attached to new orgs. Auto-create a one-person org per existing vendor login for continuity, or hold them in staging for manual matching?
3. **Default approval limit** — the dollar figure above which additional work needs ARHA approval. Per property, per category, or one global default?
4. **Trial job count** — how many trial jobs before an Approved decision? Assuming 3 unless told otherwise.
5. **Notion vendor database** — none of the currently shared Notion databases is a vendor master. Which database holds approved vendors, and can it be shared with the Lovable connection?
6. **Gamification visibility** — vendors see achievements from day one, or dark until after the pilot?

## 12. Risks and gaps

- **Breezeway screenshots are not data.** OCR of screenshots is error-prone (emails, phone numbers). Strongly prefer a Breezeway CSV export; otherwise every OCR'd row lands in staging as Needs Review with the source screenshot attached.
- **Market data is thin.** Most screenshot rows say "All Groups", which carries no real market meaning — coverage maps will start mostly empty and need to be built by supervisors.
- **Identity documents are the highest-risk data in the platform.** They are worth shipping last within Phase 2, behind the private bucket and audited access, rather than early.
- **Scorecard double-counting.** The existing per-job `vendor_job_ratings` and the new performance events must not both feed the same number; the rollup will treat ratings as one input among several, not a parallel score.
- **Timezone correctness** depends on property lat/lng, which not every property has geocoded yet — those properties will fall back to the market default and be flagged.
- Remaining files are still to be uploaded; agreements, price sheets, invoices, trash-valet schedules, and ID documents will slot into `vendor_documents` and the coverage/recurrence tables described above.
