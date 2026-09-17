# Operations authenticated acceptance gate

**Release blocker:** No isolated authenticated Operations test environment has been verified. The current Lovable Preview must be treated as sharing the published backend. Code checks and read-only UI review cannot substitute for real authentication, role checks, row-level security, storage and workflow writes in a separate environment. Do not claim the Operations launch candidate has passed authenticated acceptance until this gate is met.

## Environment contract

The environment must have a separate test/staging backend and database, with no shared production tables, storage buckets, authentication users, secrets or queues. Create synthetic PC, James/Operations Supervisor, Micah/Director of Operations, Emily/Admin, vendor and owner accounts through the real authentication path. Seed synthetic properties, reservations, cleaning turns, Tickets, Work Orders, approvals and files. Disable or sandbox all external delivery by default; capture email and notifications so they cannot reach real recipients. Provide reset/reseed, unmistakable staging labels, and role/RLS checks for every account. Record the backend, Auth, Storage, jobs and delivery bindings before the first write.

The historical local Supabase/Docker setup plan in `.codex-qa.local` is an archived contingency. This matrix does not authorize installing it, migrating the shared backend or updating Lovable Preview.

## Test matrix

| ID | Scenario | Safe now | Requires isolated authenticated environment | Evidence to retain |
|---|---|---|---|---|
| OA-01 | Personal My Work views, sorting, list/board URL state and queue return | Type/build, pure view rules, read-only UI if available | PC sign-in, assigned and unrelated Tickets, desktop and 390 px mobile | PC screenshots, URL/back sequence, exact synthetic record IDs |
| OA-02 | Team Queue quick views and combined employee/team/property/location/type/due filters | Type/build and pure filter tests | James/Micah sign-in, representative synthetic workload | Filter combinations, counts and navigation return |
| OA-03 | First meaningful action, ownership, acknowledgment and handoff | Isolated unit/service mocks | PC and supervisor sessions, two-person handoff and history writes | Before/after owner and event rows; unrelated-role denial |
| OA-04 | One open Resolve Work Order per repair Ticket and Ticket↔Work Order navigation | Code/migration validation | Synthetic repair Ticket and competing creation attempts | Canonical IDs, constraint result and round-trip screenshots |
| OA-05 | Vendor dispatch, acceptance, missed commitment, vendor-complete milestone and unsuccessful repair | Code/mocks for state derivation | Synthetic vendor login and sandboxed Breezeway or captured outbound request | Delivery capture, state/event history, no premature closure |
| OA-06 | Evidence, guest follow-up, closure QA, read-only closed record and controlled reopen | Unit/service checks | PC, James and unrelated-role writes against synthetic files/records | Evidence links, history, rejected bypasses and final state |
| OA-07 | Cleaning turnover, checkout, review, rejection/rework and Property Ready/Blocked transition | Source reconciliation and code review | Synthetic reservation, departure clean, inspection and reported issue | Linked task/issue/Ticket IDs, required evidence, reviewer/history and readiness state |
| OA-08 | Routine due, completion, recently completed and demo isolation | Pure date/state tests; static inspection of demo guard | Synthetic routine records in separate demo and live test partitions | Before/after rows and proof demo did not create live rows |
| OA-09 | Guest, owner and vendor email compose/preview/send/history | Template/validation tests only; delivery disabled | Captured Outlook sandbox, synthetic recipients, real role and audit paths | Exact subject/body/recipient/sender/timestamp and provider capture |
| OA-10 | Owner approvals and private-field boundaries | Existing SQL and service tests, migration manifest checks | Separate owner and unrelated owner sign-ins with synthetic property/approval | RLS denials, reviewed snapshot and decision history |
| OA-11 | Desktop and mobile usability for PC, James, Micah and Emily | Read-only review of non-mutating screens | Each real-role synthetic session for action flows | Role-by-role observation and launch blocker / later / future classification |
| OA-12 | Migration/automation isolation and reset | Static migration checks | Staging setup, disabled jobs, captured queues and complete reseed | Environment inventory, reset receipt and no production resource IDs |
| OA-13 | Market-specific checklist transcription, required/conditional answers, photos and authorized evidence exception | Source paragraph comparison and pure rules | Synthetic OKC/non-OKC clean, QC and vacancy task with real cleaner/inspector roles and storage | Field-by-field parity sign-off for 581109/581110/32834/818192, rejected omissions, exception audit |
| OA-14 | Checkout trigger, offer/accept, clean submit, inspection, correction and readiness | Pure state/readiness tests | Real authenticated synthetic reservation and task lifecycle | Actor/timestamps, assignment history, correction rounds, blocked/ready transitions |
| OA-15 | Companywide Cleaning Review and finding decisions | Schema/code checks | Synthetic review with multiple findings, claim/deposit decision and unrelated role denial | Exact finding codes, cost/evidence links, explicit decision audit, no automatic charge |
| OA-16 | Supervisor daily log and reference catalog | Static schema/source checks | Synthetic workload aggregation, Director review and tag scope/legacy checks | Count reconciliation, role routing, external IDs and historical mapping |
| OA-17 | OwnerRez webhook/poll overlap, retry, changed checkout, cancellation and missing property/market | Pure synthetic event plans and static SQL checks | Isolated service-role ingestion against synthetic OwnerRez payloads and database | One turnover per booking, event ledger/result/error, preserved active task, exception row and concurrency result |
| OA-18 | Verified property-default assignment, unassigned risk, acceptance deadline and manual choice | Pure synthetic selector/deadline tests | Synthetic property defaults, markets, blackout, decline and expiry under real role/RLS paths | Assignment source/priority, untouched unverified cleaner, visible queue and history |
| OA-19 | Checklist review and billing authority | 636-row register completeness check and pure required/conditional/photo tests | James and Micah review workflow, storage evidence, Emily escalation and authorized billing decision | Signed version/effective date, rejected missing evidence, decision actor/reason/amount and no external charge |
| OA-20 | Guest billing PC → James → Micah when escalated → Finance, including variance and execution evidence | Synthetic role/state tests and local UI build | Authenticated role/RLS writes against synthetic review, claims, files and amounts | Complete audit trail, rejected PC self-approval, reapproval after amount change and Finance reconciliation |
| OA-21 | Verified Breezeway property-default import and manual market choices | Empty reconciliation schema and selector tests | Current-source evidence, James/Micah verified synthetic defaults and unrelated property denials | Source record, verifier/time, no automatic market fallback, unassigned queue |
| OA-22 | Disabled ingress, replay, retry and expiry worker | Synthetic HMAC/timestamp/retry tests and static config review | Isolated endpoint with verified OwnerRez-native signing or trusted gateway and safe scheduling | Denied stale/forged delivery, single turnover under concurrent retry, bounded retry/expiry history |

## Reporting lanes

- **Passed through code or isolated automated testing:** record command, commit and result. This does not imply role acceptance.
- **Verified through safe read-only UI review:** record URL, role, date and observed screen without changing shared data.
- **Blocked pending isolated authenticated acceptance:** all write, role/RLS and end-to-end cases in the matrix above until the environment contract is proven.
- **Blocked pending external sandbox credentials:** Outlook/Breezeway/OwnerRez or other provider delivery tests when a safe sandbox is unavailable; credentials must be scoped to synthetic recipients and resources.

## Current verification record (09/17/2026)

| Lane | Result | Limit |
|---|---|---|
| Passed through code or isolated automated testing | TypeScript `tsc --noEmit`, production Vite build, focused ESLint, twenty-one Node isolated cleaning/OwnerRez/billing tests, checklist archive boundary and 636-row review-register checks passed. The feedback register has 54 unique IDs. | Bun-based legacy tests still lack a runner. All three cleaning migrations are **unapplied** and unvalidated against a database. The synthetic UI compiled but has not undergone browser usability review. Every real checklist field still needs James review and Micah approval. |
| Verified through safe read-only UI review | None on this Operations branch. | The existing PR #10 Preview is a different branch; shared Preview is treated as a published-backend environment and has not been used for Operations acceptance. |
| Blocked pending isolated authenticated acceptance | OA-01 through OA-22 action, role, RLS, storage, transaction concurrency and reset cases. | No separate backend and synthetic accounts have been verified. The cleaning schema grants authenticated users read access only when they are staff; task writes are intentionally unexposed. The ingestion SQL function is service-role-only and has not run. |
| Blocked pending external sandbox credentials | Microsoft 365 delivery and Breezeway/OwnerRez integration calls. | No isolated provider bindings or captured delivery endpoints have been verified. |

Until staging exists, do not create, update, assign, complete, approve, reopen or delete shared operational records. Do not trigger external messages, webhooks, sync writes or automations, and do not use real people or properties as disposable fixtures.
