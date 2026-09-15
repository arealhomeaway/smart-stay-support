# Locked Active Owner Ticket coverage

User direction received September 15, 2026. This extends the active build goal within the existing Active Owner architecture. It does not authorize shared migrations, deployment, account changes or messages.

## Required behavior

- Every operational Ticket for an enrolled Property must be represented in the owner's Active Owner experience, including Tickets requiring no owner action.
- Automatically create or update the linked opportunity. Ordinary Tickets must not depend on a staff member manually offering them. Stage changes must not create duplicates.
- Retain canonical Ticket, Property and Owner/program links. Use the existing opportunity and time-entry architecture.
- There is one canonical Owner identity. Enrollment must reference the canonical Owner + Property relationship. Never create or normalize a second identity from free-text names/emails.
- Show an owner-safe projection with relevant property context, what happened, what ARHA did, cost/outcome where appropriate, and whether action is required. Exclude guest PII, internal notes, credentials and other restricted operational content.
- Use the Welcome Packet taxonomy: Approve only; Review & comment; Review & decide; Provide information; Attend & respond; Action or payment required; Information only; Research & recommend.
- Every opportunity must explain WHY approval, a decision, information, action or review is required. A Ticket requiring no owner action remains a Review opportunity, with the presentation “Review — No approval required.”
- Read classification from Resolve's canonical approval/authority logic. The $150 example is illustrative, never a universal threshold. Explain existing management authority accurately; do not turn missing authority evidence into an assertion that work is authorized.
- Owners can open/review the opportunity, log actual legitimate participation against it, and retain it in participation history. Review-only work qualifies when the owner actually reviews it. Never automatically award hours.

## Current evidence and implementation work

Status: PENDING implementation of the complete locked requirement. Existing building blocks are present, but do not satisfy automatic coverage.

1. `src/lib/owner-opportunity.server.ts` manually inserts thin `owner_reviews` linked to Tickets/properties/programs. Reuse this model. The existing `(program_id, ticket_id)` unique index in migration `20260903175808_873fb28c-18a0-4068-88d4-cb7b6bcef404.sql` provides an existing duplicate boundary; generation must update the same opportunity without losing participation history.
2. `src/lib/owner-portal.server.ts` currently reads raw Ticket title/description/resolution notes and caps the feed at 120 rows. Raw text is not owner-safe merely because internal comments are absent. The projection and complete Ticket coverage need implementation before acceptance.
3. `src/lib/owner-opportunity.ts` and database constraints currently support six legacy action codes, not the eight locked request categories. Extend compatibly without rewriting prior participation records.
4. `src/lib/maintenance-policy.ts` supplies canonical authority types/policy evaluation. Integrate with the actual saved Ticket approval/authority context; do not duplicate dollar rules in the opportunity generator.
5. `properties.owner_record_id` references the existing `property_owners` identity. `owner_programs` currently has portal-user and free-text contact fields but no explicit canonical Owner-record link. Add validated linkage through the existing relationship; do not guess a backfill by name/email.
6. `logOwnerTime` already requires an opportunity, and transactional entry/link functions preserve participation context. Verify review-only generated opportunities remain usable and historically retained.

## Product/security conflicts identified before implementation

- Automatically copying the existing manual offer defaults would publish unrestricted Ticket text. Use an explicit safe projection, not regex-based claims of complete redaction.
- Existing program contact fields cannot establish canonical ownership. Missing or ambiguous canonical links require visible resolution; they cannot justify a second identity model or a guessed owner mapping.
- Six-code legacy taxonomy cannot fully represent the eight locked requests. Schema/presentation compatibility must be handled explicitly.

## Acceptance evidence required

Test all Tickets across enrolled properties, including more than the current feed cap; initial generation, stage updates and repeat/concurrent synchronization; correct Ticket/Property/Owner/program linkage; all eight request categories and explanations; canonical authority changes without hardcoded thresholds; restricted-content exclusion; unrelated-owner and non-enrolled-property denial; review-only logging and retained history; canonical identity mismatch handling without name/email matching. Reconcile actual schema/RLS and rendered authenticated owner views in the approved isolated acceptance environment.

### September 15 follow-up: canonical Owner enrollment foundation

Migration `20260915050000_canonical_owner_enrollment.sql` adds the existing `property_owners` foreign key to programs, a unique active program per canonical Owner/demo partition, and trigger validation for new program/enrollment identity. A bound program cannot replace its Owner identity; existing unbound programs are not guessed or backfilled. New enrollment must match the program and Property canonical Owner. No existing RLS or portal-user mapping changed.

`createProgram` now resolves `properties.owner_record_id`, checks that canonical Owner is active, reuses programs by the Owner ID rather than email, and snapshots contact details from that record. Submitted contact fields no longer establish identity. `addProgramProperty` rejects missing/mismatched identity, and onboarding's enrollment helper goes through the same validation instead of trusting an existing link without checking it.

666 unit tests / 76 files / 1918 assertions pass; TypeScript and focused lint pass (generated types use the documented formatting-baseline exception). All 23 isolated migration files pass, including cross-owner rejection, unbound creation, duplicate active program prevention, immutable bound identity and preservation of unresolved legacy records. Production client/server build passes in `.codex-qa.local/build-20260915-canonical-owner`. Migration is unapplied to shared/live.

Locked Ticket requirement status: PARTIALLY IMPLEMENTED. This is the canonical enrollment foundation, not automatic Ticket coverage. Automatic generation, safe operational projection, eight request types/explanations, legacy reconciliation UI and updated contact controls remain. Existing property-owner changes and complete activation/enrollment concurrency need further audit. Program/link/history creation remains multiple writes; this checkpoint does not claim it is atomic. No owner user account was created, rebound or inferred from contact text. MORE IMPLEMENTATION REQUIRED.

### September 15 follow-up: Welcome Packet request taxonomy

New opportunity offers now expose exactly the eight locked request labels. Server validation accepts those codes plus the six legacy values for compatibility; historical labels remain readable. `opportunityDecisionPath` preserves the approval path for Approve only and the informational path for Information only. The latter explicitly describes actual review time without creating an approval gate. Generic category hints describe the requested response; they are not substitutes for the required Ticket-specific WHY.

Migration `20260915060000_owner_request_taxonomy.sql` extends existing review/template constraints and changes new-record defaults to review_comment without rewriting existing rows. No schema is applied to shared/live. Tests verify all eight labels, legacy support, informational/approval paths, database acceptance, invalid-code rejection, preservation of historical codes and new defaults.

668 unit tests / 77 files / 1939 assertions pass; TypeScript and focused lint pass; all 24 isolated migration checks pass; production client/server build passes in `.codex-qa.local/build-20260915-owner-taxonomy`. Existing offer UI and server modules were extended; no parallel opportunity store was introduced.

Locked Ticket requirement remains PARTIALLY IMPLEMENTED. Automatic Ticket synchronization, owner-safe context, canonical authority-driven classification and per-Ticket WHY are still pending, as are legacy identity reconciliation and authenticated acceptance. The existing manual offer path is not a substitute for automatic coverage. No hours are generated and no messages are sent by this change.

### September 15 follow-up: structured owner Ticket projection and complete feed

`loadOwnerHomeByProgram` now requests Tickets only for `includedProperties`, rather than every historical enrollment. `loadOwnerTicketProjection` pages exact-count results with deterministic ordering and batches property filters in groups of 100. The former 120-Ticket limit and archive exclusion are removed, so visible archived work remains in history. Caller RLS and the existing non-preview demo filter still apply.

The query no longer selects raw Ticket title, description or resolution notes. A fixed-field projection returns canonical IDs/reference, known category/status/priority values, dates and allowlisted owner-submission metadata; unknown textual values cannot carry arbitrary content into those fields. Titles are derived from canonical category labels and Ticket references. Until a reviewed owner-safe narrative path exists, the description explicitly says detailed owner-safe work information has not yet been published. This is an interim safety boundary, not fulfillment of the full operational-context requirement.

670 unit tests / 78 files / 1953 assertions pass; TypeScript and focused lint pass; all 24 isolated migrations pass; production client/server build passes in `.codex-qa.local/build-20260915-owner-ticket`. Tests inject private text into source fields and unknown enum values, verify exclusion, and load 1305 Tickets across 101 properties under a 200-row backend cap, retaining archived history while excluding unrelated homes and demo records. No schema or RLS changes in this checkpoint.

Locked requirement remains PARTIALLY IMPLEMENTED. Automatic opportunity materialization, reviewed work/cost/outcome context and authority-driven WHY remain pending. The canonical Operations approval path is in `work-orders.ts` (`ownerApprovalRequest`) and linked `approvals` records for `entity_type=work_order`; saved work-order authority, quotes and approval state must be used instead of the owner's submitted Ticket path or a new dollar rule. Full owner payload/RLS proof, including reviews and other detail endpoints, is still outstanding.
