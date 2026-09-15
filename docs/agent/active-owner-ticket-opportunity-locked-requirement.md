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

### September 15 follow-up: canonical Work Order authority explanations

`ownerTicketRequest` reuses `work-orders.ts` evaluateAuthority; it does not define spending thresholds. The Ticket projection now loads paged, narrowly selected Work Order authority inputs and attaches request category, label, WHY, action-needed state and policy versions. Work Orders must match both Ticket and Property. Raw scope, vendor/contact and internal notes are not selected or copied into the explanation.

The $150 example is covered as Review — No approval required through canonical evaluation. Other cases cover owner approval across multiple Work Orders, supervisor-only authorization, missing quote/authority, emergency mitigation limited to the immediate issue, prior decisions and declined work. An approved amount that is absent or below the current quote remains unconfirmed. The owner's submitted Ticket path is not used to decide spending authority. Review time remains actual manual participation.

676 unit tests / 79 files / 1977 assertions pass; TypeScript and focused lint pass; all 24 isolated migrations pass; production client/server build passes in `.codex-qa.local/build-20260915-owner-authority`. No schema, access policy or external data changed.

Locked requirement remains PARTIALLY IMPLEMENTED. These are serialized request explanations, not yet the complete owner-facing opportunity flow. Automatic opportunity synchronization, canonical approval-record reconciliation against the Work Order mirror, rendered explanations, detailed safe work/cost/outcome publishing, and canonical identity validation of existing enrollments remain pending. Full-schema RLS/owner isolation and authenticated acceptance are not proven by this classifier. Next implementation must connect these pieces without treating missing authority or legacy Owner links as authorization.

### September 15 follow-up: canonical approval receipt reconciliation

The owner Ticket projection now reconciles Work Order approval mirrors against canonical owner approvals matched by approval ID, Work Order ID, Property ID and approver role. A pending canonical decision overrides a stale approved mirror. Missing, mismatched or unsupported records leave authority unconfirmed; approved records require a decision timestamp and valid amount. Both the canonical amount and any narrower mirrored approval must cover the current quote. Non-preview approval reads exclude demo records. No raw approval title, detail, decision note or contact data is selected.

679 unit tests / 80 files / 1997 assertions pass; TypeScript and focused lint pass; all 24 isolated migration checks pass; production client/server build passes in `.codex-qa.local/build-20260915-owner-approval`. Tests cover stale decisions, identity mismatches, missing receipts and changed amounts. No schema or RLS changes were introduced.

Locked requirement remains PARTIALLY IMPLEMENTED. Automatic opportunity synchronization, rendered explanations, detailed safe work/cost/outcome publishing and canonical identity validation of existing enrollments remain pending. Separate reads are not a transactional snapshot; this metadata is not an approval mutation or authorization to perform work. Full owner payload/RLS and authenticated acceptance remain unproven. No access is needed for the remaining independent local implementation.

### September 15 follow-up: work-alert text safety

Inspection found a bypass of the structured Ticket projection: existing database notification triggers copy raw Ticket titles/descriptions/resolution notes into owner_notifications, and the hub and delivery worker previously forwarded those fields. The shared ownerNotificationText formatter now replaces Ticket/review alert text at both output paths, retaining urgency/resolution and directing owners to the portal without implying every review requires approval. It also covers historical alerts whose Ticket link has been removed. Delivery-worker contact tasks use the same text. No delivery worker was executed and no external message was sent.

681 unit tests / 81 files / 2012 assertions pass; TypeScript and focused lint pass; all 24 isolated migrations pass; production client/server build passes in `.codex-qa.local/build-20260915-owner-alert-safety`. Injected private text is excluded from linked and legacy work notifications. No schema/RLS changes or stored notification updates were made.

Locked requirement remains PARTIALLY IMPLEMENTED. This closes these application output paths, not direct-table exposure. Existing notification generators still store raw text, direct database owner access needs review, and canonical enrollment/current-property checks on notification routing remain incomplete. Automatic opportunity generation must account for existing notification triggers before adding records. Detailed owner-safe operational context, automatic synchronization and authenticated isolation remain required; generic alert text is not a substitute for the opportunity itself. No access is needed for independent local fixes.

### September 15 follow-up: canonical Ticket alert routing

Before a queued Ticket alert can reach email or a contact task, ticketAlertRecipient rechecks the program canonical Owner, portal-user binding, active/pending status, archive/demo state, current Ticket Property and included enrollment. Contact details come from property_owners, not the program's free-text snapshots. Missing sources, changed ownership, removed enrollment, inactive Owners or failed lookups skip delivery with a staff-review reason. No worker was executed and no external messages or contact tasks were created.

685 unit tests / 82 files / 2033 assertions pass; TypeScript and focused lint pass after adapting rejection assertions to the repository test declarations. All 24 isolated migration checks pass. Production client/server build passes in `.codex-qa.local/build-20260915-owner-alert-identity`. Tests cover canonical secondary-property routing, identity mismatch, removed enrollment, demo/inactive/archive states and failed reads.

Locked requirement remains PARTIALLY IMPLEMENTED. This guard handles Ticket-linked delivery; non-Ticket review delivery, stored raw notification text, owner hub/direct-table access and concurrent ownership/recipient changes still require review. Separate preflight reads do not establish an atomic delivery claim or prevent every concurrent reassignment. Automatic opportunity creation, rendered WHY and detailed safe work/cost/outcome publishing remain required. No approval/access is needed for independent local implementation; authenticated acceptance still needs an approved isolated environment and test roles.

### September 15 follow-up: safe notification generators

Migration 20260915070000_safe_ticket_notifications.sql replaces the existing Ticket and review notification generators with fixed alert text, excluding raw titles, descriptions, resolution notes, recommendations and impact. Ticket routing uses canonical Owner + included Property enrollment (including secondary homes), active/pending unarchived non-demo programs and active canonical Owners. Review alerts validate their program and, when property/Ticket-linked, the current canonical Property relationship. Existing channel preferences and trigger execute restrictions remain; this is not a new delivery channel or an RLS change.

All 25 additive migrations pass the isolated runner. New tests cover secondary-property routing, event duplicate suppression, resolution context, private text exclusion, removed enrollment, transferred ownership, demo records, review/Ticket property mismatch and trigger privilege restrictions. The fixture now includes the existing anon role so revocation is tested against the intended schema. Focused runner lint and diff whitespace checks pass. Application code is unchanged from dbd2b97, where 685 unit tests, TypeScript, focused source lint and production build passed; those unchanged checks were not repeated for this SQL-only checkpoint.

Migration remains unapplied to shared/live. No existing notification rows were rewritten, no delivery worker ran and no message was sent. Historical raw storage and direct-table access remain unresolved; the prior application output sanitizer still protects those output paths. Non-Ticket delivery concurrency and full-schema permissions need acceptance. Locked requirement remains PARTIALLY IMPLEMENTED: safe notification generation is a prerequisite, not automatic Ticket opportunity materialization or detailed owner context. The next implementation must reuse owner_reviews while preserving decisions/time history and avoiding duplicate notification fanout.

### September 15 follow-up: automatic Ticket opportunity creation

Migration 20260915080000_automatic_ticket_opportunities.sql reuses owner_reviews and the existing program/Ticket uniqueness rule. Ticket inserts/updates, enrollment inclusion and program identity/status changes ensure linked opportunities for canonical included Properties. An initial reconciliation covers existing eligible Tickets without guessing legacy Owner identities. New rows use fixed safe text, property links and an auto_ticket marker; existing rows, decisions and time links are not replaced. Closed Tickets remain review opportunities. Automatic rows suppress duplicate review-ready notifications; ordinary Ticket notifications remain governed by the prior safe generator.

The owner hub decorates generated reviews with the current canonical Ticket authority request, category and WHY, preserving review ID/status/recorded response. Missing or mismatched Ticket context leaves authority unconfirmed. Manual opportunity rows are preserved. A detailed work summary is explicitly pending publication; automatic creation does not invent a narrative or participation time.

687 unit tests / 83 files / 2042 assertions pass; TypeScript and focused source/runner lint pass. Generated types pass logic lint with the existing formatting-baseline exception. Production client/server build passes in `.codex-qa.local/build-20260915-automatic-ticket`. All 26 isolated migration files pass. Tests prove creation for pre-enrollment and new Tickets, stage-change identity/decision preservation, property-link uniqueness, demo/removal exclusion, closed-work coverage, notification suppression, restricted sync execution and atomic rollback when a link insert fails. UI projection tests cover review/approval WHY and wrong/missing property context.

Locked requirement remains PARTIALLY IMPLEMENTED. Detailed reviewed work/cost/outcome content, canonical approval-response integration, all eight automatic request sources, existing manual/legacy reconciliation and complete authenticated owner isolation remain open. Persisted generated rows have an informational base; the hub derives current authority at read time, so other review/detail paths require integration. Multi-connection concurrency, property transfers, direct-table bypass, unbound legacy programs and the full deployed trigger graph remain unproven. Sync failures deliberately roll back the source write; test this behavior and deadlock/retry handling against an approved isolated full schema before acceptance. No shared migration, message or production data change occurred.

### September 15 follow-up: participation response safeguards

respondToReview now verifies the current program Owner and availability, rejects closed/archived programs and unavailable reviews, and compares viewed status/updated_at before saving. Automatic Ticket opportunities accept acknowledgement only through this path; arbitrary repair approval decisions are rejected. Acknowledgement preserves the automatic opportunity's outstanding status and records a participation-response event rather than a repair approval. This avoids dismissing a separate canonical decision request.

690 unit tests / 84 files / 2057 assertions pass. TypeScript passes after correcting a test-only index-signature access; focused lint, production client/server build (`.codex-qa.local/build-20260915-owner-review-response`) and all 26 isolated migration checks pass. Denial tests cover another Owner, closed/archived programs, future/already-answered reviews, forged approval text and stale writes.

Locked requirement remains PARTIALLY IMPLEMENTED. The owner UI still submits acknowledgement, not a canonical Work Order approval. A complete per-request approval interaction is required. Automatic review-only items also need a participation-completion display distinct from outstanding operational decisions; preserving status here is an interim safety safeguard. Response/history writes remain non-atomic and program reassignment concurrency is not solved by the viewed-review comparison. Detailed safe summaries, full-schema owner access and authenticated acceptance remain open. No new migration or external action occurred.

### September 15 follow-up: atomic response and history

Migration 20260915090000_atomic_owner_review_response.sql adds an invoker-security response RPC that locks the review, verifies the caller's program and availability, compares the supplied database version, preserves automatic-request status, and commits response plus previous/new response history together. The server uses this RPC instead of separate review/event writes. Badge refresh remains on hub load, removing a post-commit error path that could falsely report a saved response as failed. Existing RLS applies; no table policy or shared schema was changed.

690 unit tests / 84 files / 2057 assertions pass; TypeScript and focused source/runner lint pass (generated types retain the documented formatting-baseline exception). Production client/server build passes in `.codex-qa.local/build-20260915-atomic-review-response`. All 27 isolated migration files pass. Owner-role SQL checks prove response/history persistence, history-failure rollback, cross-owner denial, stale version rejection and rejection of repair approval through automatic acknowledgements. The initial fixture failure was corrected to use the runner's test.actor identity and scoped history policies.

Migration remains unapplied to shared/live. Complete concurrency acceptance is still open: the server currently supplies its freshly read review version, not the version the browser originally displayed, and program reassignment is not locked across the response transaction. Canonical approval UI, separate participation-completion display, detailed safe summaries and authenticated/full-schema owner isolation remain required. Locked requirement stays PARTIALLY IMPLEMENTED. The Lovable preview branch remains at the explicitly requested 626b33a7e751a648d6f05309bd4d851f2e1c3036; only the feature branch advances.
