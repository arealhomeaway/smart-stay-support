# Operations authenticated acceptance gate

> **Current acceptance direction (09/18/2026):** Emily superseded the separate Supabase/backend requirement below. It is not a launch blocker. Use practical, risk-based authenticated browser review in the existing Lovable/GitHub application, with non-destructive reads of normally visible data. Do not use real records as disposable fixtures, send provider writes, apply migrations, or claim unperformed end-to-end acceptance. The historical environment contract and matrix below are retained only as a record of the earlier plan. For the Availability Finder, review role access, search, the selectable 5/10/15/20-mile map/list population, filter and URL state, conflict display, theme, responsive layout, selected-only PDF download, and every PDF public-listing link. PDF generation is read-only with respect to shared application data.

> **Scope correction (09/17/2026):** The [current Operations launch matrix](operations-launch-recovery-2026-09-17.md#current-scope-acceptance-matrix) governs release acceptance. Cleaning turnover, cleaner tasks, native inspection/readiness, guest billing and deposit cases below are deferred research, not current launch blockers. Keep them for traceability only. P1–P3 is the sole active priority model.

**Historical gate, superseded:** A separate authenticated Operations test environment was previously listed as a release blocker. Emily explicitly removed that requirement on 09/18/2026. The current Lovable Preview may share the published backend, so browser acceptance stays non-destructive and provider writes remain prohibited. Code checks do not replace the remaining practical authenticated browser review.

## Current branch acceptance additions

| Case | Automated evidence | Remaining non-destructive browser review |
|---|---|---|
| OA-13 Availability filters and PDF | Combined and missing-metadata filters, map/list parity, URL state, public URL rejection and PDF hyperlink tests | Search real visible data, change radius and filters, reload/back, select properties, open downloaded PDF outside Resolve and click every CTA/image |
| OA-14 Global theme | Persistence, pre-paint bootstrap, launch-portal wiring and fixed light PDF tests | Light/Dark/System across shell, maps, forms, dialogs, tabs and responsive layouts |
| OA-15 Shared collection views | Calendar mechanics, URL-origin state and applicable-control tests | Team Queue, Onboarding, Active Owner and Properties view/filter/sort/return behavior by authorized role |
| OA-16 Guided Ticket work | Automatic intake priority, supervisor denial/correction unit checks plus existing stage, lifecycle, Work Order and provider contract tests | Read-only inspection of representative existing Tickets by PC/supervisor/director; any mutating acceptance requires Emily to identify disposable QA records first |

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

## Reporting lanes

- **Passed through code or isolated automated testing:** record command, commit and result. This does not imply role acceptance.
- **Verified through safe read-only UI review:** record URL, role, date and observed screen without changing shared data.
- **Blocked pending isolated authenticated acceptance:** all write, role/RLS and end-to-end cases in the matrix above until the environment contract is proven.
- **Blocked pending external sandbox credentials:** Outlook/Breezeway/OwnerRez or other provider delivery tests when a safe sandbox is unavailable; credentials must be scoped to synthetic recipients and resources.

## Current verification record (09/17/2026)

| Lane | Result | Limit |
|---|---|---|
| Passed through code or isolated automated testing | TypeScript `tsc --noEmit` passed on `codex/ops-launch-pass-2`. The production Vite build passed at the last code checkpoint. Static migration inspection found 181 SQL files, no duplicate filename timestamp prefixes, and no migration or generated Supabase type changes relative to the PR #10 base. The feedback register has 33 distinct IDs. | Bun-based focused tests could not be run because the Bun runner is unavailable; no test result is claimed for them. Static checks do not prove migration behavior against a database. |
| Verified through safe read-only UI review | None on this Operations branch. | The existing PR #10 Preview is a different branch; shared Preview is treated as a published-backend environment and has not been used for Operations acceptance. |
| Blocked pending separately authorized mutation | OA-03 through OA-10 and OA-12 write-path cases. | Use non-destructive review now; do not mutate shared records unless Emily identifies a disposable QA record for that exact test. A separate backend is not a launch requirement. |
| Blocked pending external sandbox credentials | Microsoft 365 delivery and Breezeway/OwnerRez integration calls. | No isolated provider bindings or captured delivery endpoints have been verified. |

While Preview may share the published backend, do not create, update, assign, complete, approve, reopen or delete shared operational records during this acceptance pass. Do not trigger external messages, webhooks, sync writes or automations, and do not use real people or properties as disposable fixtures.
