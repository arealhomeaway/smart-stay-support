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
