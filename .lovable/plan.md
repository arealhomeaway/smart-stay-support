# Resolve Platform Expansion — Architecture Proposal

No code changes yet. This is the consolidated architecture for turning Resolve into ARHA's modular, company-wide operating platform.

## 1. What already exists and gets reused

- **Identity & roles**: `user_roles` + `has_role()`, `is_staff/is_supervisor/is_platform_owner/is_onboarding_staff`, capability matrix in `src/lib/permissions.ts`, `useRole`, `RequireCapability`, portal switcher and read-only "View As".
- **Shared property record**: `properties` with `lifecycle_status`, `onboarding_stage`, `quarterly_review_due_on`, geocoding, and external IDs (`ownerrez_property_id`, `breezeway_property_id`).
- **Work engine**: `tickets` (matters) with work types, SLA clocks, ownership, handoffs, escalation, closure gates, `ticket_activity`, `ticket_steps`, playbooks.
- **Onboarding**: `onboarding_tasks` (stage, owner, due date, evidence, blockers, approvals, carryover) and `property_handoffs` (checklist, validation, open task IDs, review).
- **Vendors**: dispatch, visits with geo check-in, scorecards.
- **Homeowners**: owner programs, reviews, time entries, notifications, contact alerts.
- **Executive layer**: `/command-center` with the KPI engine in `command-center.server.ts` (real-records-only, exception-first) and `audit_log`.
- **Integrations**: server-only OwnerRez client, inbound sync with `external_source`/`external_id` idempotency, Notion API key already stored server-side.

Everything above is preserved. No records are duplicated and no route is removed.

## 2. Modular department architecture

One platform, shared records, department *lenses* rather than separate apps.

```text
Executive Command Center      (Platform Owner: company-wide)
        |
Department Dashboards         (Onboarding, Operations, Vendors, Finance,
        |                      Pricing/Revenue, Listings, Owners)
        |
Workspaces & Portals          (staff daily work, vendor portal, owner portal)
```

Shared spine: properties, owners, guests/stays, vendors, users, matters, approvals, documents, communications, financial refs, pricing refs, audit events.

New generic primitives so future departments need no restructuring:
- `departments` — registry (code, label, landing route, active).
- `department_members` — user ↔ department ↔ scope (which markets/properties).
- `approvals` — polymorphic approval requests (entity type/id, kind, amount, requested_by, approver, limit checked, decision, evidence).
- `documents` — polymorphic file/link records with owning department and visibility.
- `external_links` — one row per (resolve entity, system, external id, last synced, status). Replaces adding a new column per system.
- `integration_events` — every sync attempt: system, direction, entity, payload hash, status (pending/ok/failed/conflict), attempts, next retry, error.
- `field_conflicts` — open conflicts with both values, awaiting an authorized decision.
- `metric_definitions` — one shared definition per KPI so department and executive numbers reconcile.

## 3. Property & external-record ID strategy

The Resolve `properties.id` UUID is immutable and permanent from onboarding through offboarding. Lifecycle moves the same row: `onboarding → handoff_requested → active → paused → offboarded`. Every external system stores its ID in `external_links` (`notion_page`, `ownerrez_property`, `pricelabs_listing`, `quickbooks_customer/class`), never as a new property row. Ingest is upsert-by-external-link, so re-syncs update instead of duplicating; a match on address/name without an external link raises a duplicate warning for a human, it does not auto-merge.

## 4. Notion integration (Phase 1)

Method: server-only Notion REST API (v1) using the stored key, called from `notion.server.ts` behind `createServerFn`; never touched from the browser. A `/api/public/sync/notion` route handles scheduled pulls with the cron secret.

- **Pull**: page the property database, map properties by `external_links`, upsert the Resolve mirror, record `integration_events`.
- **Push (Phase 1b)**: authorized Resolve edits enqueue a write event; a worker applies it with a payload hash for idempotency, exponential backoff on 429/5xx, and a max attempt count before it lands in the retry queue.
- **Phase 1 starts read-only** as agreed: Resolve mirrors Notion, we verify the field match together, then enable write-back.
- Admin UI: last successful sync per system, pending/failed/conflicting counts, retry-and-resolve queue, and per-record sync history with rollback to the previous captured value where practical.
- Conflicts are never silently overwritten: both values are shown side by side and an authorized user picks or corrects.

### Field ownership map (shape)

Each field row records: authoritative system · editable in Resolve (yes/no/with-approval) · roles allowed to edit · conflict rule (source wins / Resolve wins / manual) · history location.

| Field group | Source of truth | In Resolve |
| --- | --- | --- |
| Property master (name, address, unit, owner link, SOP content) | Notion | Editable by onboarding staff + supervisors, written back |
| Onboarding checklist progress, evidence, approvals, handoff | Resolve | Editable; summary status mirrored to Notion |
| Reservations, availability, guest/stay, applied nightly rate | OwnerRez | Read-only |
| Base/min rate, pricing rules and recommendations | PriceLabs | Read-only (not connected in Phase 1 — labelled as such) |
| GL, bills, invoices, payments, reconciliations | QuickBooks Online | Read-only in the first Finance phase |
| Matters, assignments, SLAs, vendor activity, audit | Resolve | Authoritative |

## 5. Onboarding workflow & handoff

Resolve replaces the Notion forms with structured, staged forms driven by ARHA's real checklist (I'll build against the Notion database you share — I will not invent stages). Each task keeps responsible person, due date, status, required property fields, documents/evidence, dependencies, blockers, notes, approvals, completion requirements, change history.

Handoff: readiness computed from required tasks → **Request Handoff** → server-side validation (required fields, documents, approvals, open blockers) → supervisor review → **Accept** or **Return with corrections**. A property cannot reach `active` without an accepted handoff. Acceptance records date/time and accepting user. Open issues, blockers and carryover tasks stay attached to the property after activation — they are re-pointed to Operations, never closed or detached.

## 6. Roles and permissions

Enforced in RLS and server functions; navigation only mirrors it.

| Capability | Platform Owner | Supervisor | Dept user | Vendor | Homeowner |
| --- | --- | --- | --- | --- | --- |
| Executive Command Center | Yes | No | No | No | No |
| Department dashboard | All | Assigned depts | Own dept | No | No |
| Cross-department records | All | Assigned | Assigned scope | No | No |
| Finance data | Yes | Only if in Finance | Only if in Finance | No | No |
| Users, roles, seats, integrations, settings, approval limits, metric definitions | Yes | Seat assignment only | No | No | No |
| Audit history & data corrections | Yes | Own dept | No | No | No |
| Correct / archive records | Yes | Yes | No | No | No |
| Hard delete | Nobody — archive + audit only |

Supervisors get no automatic company-wide or financial access; Finance access requires membership in the Finance department.

## 7. QuickBooks (confirmed: QuickBooks Online)

OAuth 2.0 with server-side token storage and refresh; tokens never in Notion or frontend. Start read-only: bills, invoices, vendors, payments, accounts, and transaction IDs linked to Resolve properties and matters via `external_links`. Resolve owns the workflow layer (spend requests, owner approvals, refund/discount approvals, reimbursements, cost exceptions, reconciliation exceptions, owner-statement review, missing documentation, actual-vs-budget follow-up) — never a second ledger. Any future write requires Finance-restricted permission, defined approval authority, duplicate prevention, audit history, and error handling.

## 8. PriceLabs & OwnerRez data flow

PriceLabs → OwnerRez stays untouched. Resolve reads applied nightly rates and reservations from OwnerRez and derives occupancy, ADR, RevPAR and booking pace. PriceLabs-specific panels (sync status, base/min rate changes, override approvals) are scaffolded but clearly labelled "not connected" until an API key exists.

## 9. Executive Command Center

Keeps the current polished, exception-first design and expands to sections: Company Overview, Onboarding, Operations, Vendor Management, Finance, Pricing & Revenue, Owner Experience, System & Data Health. Every KPI carries a documented business definition, source system, current value, prior period, trend, target/range, risk status, last refresh, and a drill-down link — all sourced from `metric_definitions` so department dashboards reconcile. Filters: date range, department, market, property, pod, owner, vendor, priority, workflow status. Anything without a verified source renders as "Not connected — needs <system>", never as a number.

## 10. Phased roadmap

1. **Phase 1a — Foundation**: departments, department_members, external_links, integration_events, field_conflicts, documents, approvals, metric_definitions + RLS/GRANTs. Backfill existing OwnerRez IDs into `external_links`. No UI regressions. Rollback: additive tables only, drop-safe.
2. **Phase 1b — Notion read-only sync**: property mirror, sync dashboard, retry queue, duplicate warnings. Risk: schema mismatch — mitigated by reviewing your Notion database with you first.
3. **Phase 1c — Onboarding forms in Resolve**: real checklist stages, evidence, approvals; still read-only to Notion.
4. **Phase 1d — Notion write-back**: authorized fields only, conflict UI, rollback per change.
5. **Phase 2 — Handoff hardening** and carryover continuity into Operations.
6. **Phase 3 — Department dashboards** (Operations, Vendors, Onboarding) on shared metric definitions.
7. **Phase 4 — Finance workspace** with read-only QuickBooks Online.
8. **Phase 5 — Pricing & revenue oversight** from OwnerRez; PriceLabs when a key is available.
9. **Phase 6 — Executive Command Center full build-out.**

Testing each phase: server-function unit checks, RLS probes per role, sync idempotency runs (double-sync must produce zero changes), and a signed-in browser pass per portal.

## 11. What I still need from ARHA

- The Notion property/onboarding database link (and confirmation the integration has access to it).
- Which Notion fields authorized staff may edit from Resolve.
- QuickBooks Online admin to authorize the connection when we reach Finance.
- Approval authority limits (who approves what spend, and at what amount).
- Department roster: who belongs to Onboarding, Operations, Vendors, Finance, Pricing.
- Market/pod definitions to drive filters.
- Target values for each KPI (what counts as green vs at risk).
