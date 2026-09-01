# Resolve — UI / Information Architecture Audit

Date: 1 September 2026 · Read-only. No routing, data, schema, integration, permission, Notion, SharePoint or Analytics change was made.

---

## 1. Full route / page inventory

All internal pages live under `_authenticated/*` behind the role gate in `src/routes/_authenticated/route.tsx`. Three gate types are in use: `RequireCapability` (capability), `SupervisorOnly` (admin/manager), and `useFeatureFlags().enabled(flag)`.

### Public
| Route | Page | Purpose | Data |
|---|---|---|---|
| `/` | Overview / portal chooser | Pre-login marketing + portal picker | Static copy + `publicPortals()`; session read only to flip CTA |
| `/auth`, `/reset-password`, `/awaiting-access`, `/oauth/sharepoint/return` | Auth utilities | Sign-in, reset, holding page, OAuth return | Auth only |

### Internal (visible today)
| Route | Page | Purpose | Primary users | Major sections | Key actions | Data source | Live? |
|---|---|---|---|---|---|---|---|
| `/dashboard` | Home (Operations) | Daily "what needs attention" | All staff | PageHeader, 4 stat tiles, "Escalated right now", "Needs attention now" | Open a ticket | `tickets`, `properties` | Live + derived |
| `/hub` | All my portals | Portal grid after login | All staff | Greeting, role badge, portal cards, live open-ticket hint | Enter a portal | `portals.ts` + `tickets` | Live |
| `/command-center` | Executive Administration | Leadership roll-up | Director/Admin (`command_center`) | `CompanyHealthPanel`, KPI blocks | — | `getCommandCenter` fn | Live |
| `/tickets` | Work queue | Ticket triage/scan | All staff | Filters, queue tabs, priority rail list | Filter, open, log ticket | `tickets` | Live |
| `/tickets/new` | Log work | Intake | All staff | Property, work type, priority, playbook | Create ticket | `properties`, `work_types`, `functional_roles`, `playbooks` | Live |
| `/tickets/$id` | Ticket detail | Execute + close | All staff | Steps, activity, evidence gate, handoff | Act, comment, close | `tickets`, `ticket_steps`, `ticket_activity` | Live |
| `/properties` | Properties | Portfolio list | Supervisor+ | Card grid (photo, name, address, ticket counts, OwnerRez link) | Import OwnerRez, refresh photos, add property, link listing | `properties`, `tickets`, OwnerRez fns | Live |
| `/property/$id` | Property Hub | One home, whole record | All staff (+owner view) | Hero, alert strip, credentials, 8 tabs | Reveal/copy credential, upload doc, open ticket | `getPropertyHubFn` | Live + **stale placeholders** (§6) |
| `/onboarding` | Onboarding workspace | Project → Task → Subtask | Onboarding (`onboarding_workspace`) | Project list, tasks, blockers, notes, handoff gate, templates, external records | Advance task, request handoff | `onboarding_tasks`, `handoffs`, etc. | Live |
| `/owner-programs` | Property owners | Active Owner admin | Supervisor+ | Program list, time review queue, rules | Approve hours, manage program | `owner_programs`, `owner_time_entries` | Live |
| `/owner` | Owner hub | Owner-facing 90-day program | Owners | Progress, log time, approvals, reports | Log hours, download PDF/CSV | owner-portal fns | Live |
| `/team` | Seats & coverage | Seats, access, schedule | Supervisor+ | 8+ stacked panels (§7) | Invite, set role, set seat, edit shifts/overrides/on-call | `functional_roles`, `coverage_*`, `oncall_roster`, `team_invites`, `profiles` | Live |
| `/map` | Work map | Geographic view of work | Supervisor+ | Map, job pins | Geocode | `jobMap`, `geocodeProperties` | Live |
| `/coach` | Ask the Coach | SOP guidance | All staff | Chat, property context | Ask | Coach fns (LLM) | Live |
| `/playbooks` | Playbooks | SOP library | All staff | Playbook + step lists | — | `playbooks`, `playbook_steps` | Live |
| `/oversight` | Oversight queue | Supervisor exceptions | Supervisor+ | P1 unacked, SLA breach, unassigned buckets | Reassign / open | `tickets` | Derived |
| `/analytics` | Analytics & KPIs | Ops KPIs | Supervisor+ | Metric cards, charts | — | `tickets` | Live |
| `/ops-analytics` | Operations performance | Deeper ops metrics | Supervisor+ | Metric cards | — | `opsAnalytics` fn | Live |
| `/owner-analytics` | Owner participation | Program analytics | `owner_programs` | Metric cards | — | `ownerAnalytics` fn | Live |
| `/integrations` | Integrations & inbound sync | Connector admin | Supervisor+ | Breezeway, SharePoint, Notion, mailbox, email delivery, feature flags | Connect, toggle flag, sync | Multiple integration tables | Live |
| `/audit` | Audit history | Accountability trail | `audit_history` | Filterable audit log | — | `audit_log` | Live |
| `/join` | Redeem invite | Invitation redemption | Invitees | Code form | Redeem | `team_invites` | Live |
| `/welcome` | Help / How Resolve works | Training | All staff | Static tip cards | — | **Hard-coded static copy** | Placeholder |

Hidden (flag-gated, correctly not user-facing): `/vendors`, `/vendor`, `/vendor/$id`, `/vendor/scorecard`, `/quarterly`.

Backend-only (no UI): 8 endpoints under `src/routes/api/public/*` — Breezeway mirror/webhook, owner notify, quarterly scheduler, email intake, OwnerRez sync, mailbox sweep, Breezeway probe.

**Notable:** there is no "Property Operations" *page*. It is a tab inside the Property Hub (`OperationsTab`), which is where the Utilities expectation is coming from (§6).

---

## 2. Navigation / IA audit

Exact current structure (`src/components/AppShell.tsx:77-126`), filtered per user by capability → supervisorOnly → feature flag; empty groups drop out.

```
Overview        Executive Administration  /command-center   (cap: command_center)
                Home                      /dashboard
                All my portals            /hub
Work            Work queue                /tickets
                Work map                  /map              (cap: matters_all)
                Ask the Coach             /coach            (cap: coaching)
                Playbooks                 /playbooks
Portfolio       Properties                /properties       (cap: properties, supervisor)
                Vendor Hub                /vendors          (flag: vendor_portal)   [hidden]
                Quarterly reviews         /quarterly        (flag: quarterly_reviews)[hidden]
                Property owners           /owner-programs   (cap: owner_programs)
                Onboarding                /onboarding       (cap: onboarding_workspace)
Insight         Analytics                 /analytics        (cap: analytics)
                Oversight                 /oversight        (cap: oversight)
                Owner participation       /owner-analytics  (cap: owner_programs)
                Operations performance    /ops-analytics    (cap: analytics)
Administration  Seats & access            /team             (cap: user_management)
                Integrations              /integrations     (cap: integrations)
                Audit history             /audit            (cap: audit_history)
                Help                      /welcome
```
Portal modes replace the whole nav: vendor → single "My company"; owner → single "My home".

### Findings per item
- **Home vs All my portals vs Executive Administration** — three competing entry points in one group. Most staff have one portal, so `/hub` is a click-through to `/dashboard`. Overlap is real; the group reads like a developer's list of landing pages.
- **Work queue** — the label does not match the fixed vocabulary. Everywhere else this is a **Ticket**; the nav says "Work queue" and the Property Hub says "Tickets". Rename to **Tickets**.
- **Work map** — a *view* of tickets, not a destination of its own; belongs as a view toggle on Tickets or Properties.
- **Ask the Coach / Playbooks** — two halves of one job (find the SOP, ask about the SOP). Staff jump between them.
- **Properties vs Property owners** — adjacent names, unrelated products (portfolio vs Active Owner program). "Property owners" should read **Active Owner**.
- **Insight group — four analytics pages.** Analytics, Oversight, Owner participation, Operations performance overlap heavily. Oversight is an *operational work queue*, not analytics, and is misfiled here. This is the single most "admin tool" part of the nav.
- **Administration** — correctly last, but "Seats & access" is doing three jobs (invites, permissions, schedule) and its page proves it (§7).
- **Help → /welcome** — static training copy; fine, but it is the only fully placeholder page in production.

### Where staff jump between pages for one workflow
1. Ticket → property context → back to ticket (`/tickets/$id` ↔ `/property/$id`).
2. Coverage question: `/team` → `/oversight` → `/tickets` to see who is actually holding work.
3. Finding a property: no local search on `/properties`, so people fall back to ⌘K, which **does not search properties at all** (§4).
4. Onboarding handoff: `/onboarding` → `/property/$id` Onboarding tab (same data, two presentations).

### Reads as a developer/admin app
`Integrations`, `Audit history`, `Operations performance`, `Executive Administration`, `All my portals`, `Work queue` — six labels drawn from system architecture rather than the job being done.

---

## 3. Home page audit

Three different "homes" exist.

**`/` (public, `src/routes/index.tsx`)** — header with `BrandLogo` + CTA; hero (eyebrow, h1 "ARHA's Central Operating Hub", paragraph, two buttons); "Why ARHA built Resolve" 4-pillar grid; "How the portals connect" 5-step chain; portal cards; footer logo. **All type and cards, no imagery.** Above the fold: eyebrow, h1, paragraph, two buttons — no photograph, no property imagery, no color field.

**`/hub`** — greeting with first name, role badge, portal cards with a live open-ticket hint, empty state if no portal.

**`/dashboard` (the real internal Home)** — `PageHeader` with live counts, four stat tiles (open / breached / unacked / resolved this week), "Escalated right now" conditional panel, "Needs attention now" list sorted by SLA. Above the fold on a laptop: header + four tiles + the start of the attention list.

**Role differences:** `/dashboard` content is **identical for Operations staff and Supervisors** — nothing branches on role inside the page. The only difference is the nav around it (Supervisors additionally see Properties, Oversight, Analytics, Team, Integrations) and the Executive Administration entry for Directors/Admins. So a Supervisor's Home tells them nothing a coordinator's Home doesn't.

**Hero/brand capability already in the codebase:**
- `src/components/BrandLogo.tsx` renders `src/assets/arha-resolve-logo.png.asset.json`; `arha-logo-white.png.asset.json` also exists.
- Two walkthrough videos exist as assets (`resolve-walkthrough.mp4`, `resolve-executive-walkthrough.mp4`).
- `public/` holds only `demo-photos/`, `favicon.png`, `robots.txt`. **There is no hero image, no photography set, and no hero component.**
- Real property photography *does* exist in data: 156 properties carry OwnerRez `primary_photo_url` — currently used only on property cards and the Hub hero.

**Why the prior polish pass did not produce a brand experience:** it standardized *primitives* (surface, stat tile, empty state) and applied them to existing layouts. It never introduced a hero surface, never used the brand color as a field (only as small accents on a warm-ivory page), and never touched `/` or the role-blindness of `/dashboard`. The result is a tidier version of the same flat card list — the page composition, not the component styling, was the problem.

---

## 4. Properties page audit

`src/routes/_authenticated/properties.tsx`, gated `SupervisorOnly`.

- **Presentation:** card grid, `grid gap-4 md:grid-cols-2` — photo, name/nickname (links to Hub), address, open/total ticket counts, access notes, OwnerRez listing linker.
- **Filters:** none.
- **Sorting:** fixed `.order("name")`.
- **Pagination:** none — all 157 rows fetched and rendered in one query (`select("*")`).
- **Search:** **none on the page.** No filter `Input` exists; the only inputs are inside the "Add property" dialog.
- **Global search dependency:** `GlobalSearch` (⌘K) is a *navigation* palette only — it searches the filtered nav item labels and nothing else. It has never been able to find a property. So today the only way to find a home is to scroll 157 cards or already know the URL.

**Confirmation:** a local "Find a property" search is trivial to add and needs no new data. Everything requested is already in the row set the page fetches: `name`, `nickname`, `address_line1`, `city`, `state`, `postal_code`, `market`, `neighborhood`, `ownerrez_property_id`, plus `owner_record_id` → `property_owners` (one extra join or a second small query). It is a client-side filter over data already in memory — no schema, no server function, no routing change. Not implemented in this pass.

Also worth noting for later: with no pagination, 157 cards each loading a remote OwnerRez photo is the heaviest page in the app.

---

## 5. Property Hub section map

Route `src/routes/_authenticated/property.$propertyId.tsx`; data from `loadPropertyHub` (`src/lib/property-hub.server.ts`, `select("*")` on `properties` + related tables).

| Section | Data source | Shown | Available but not shown | Problems |
|---|---|---|---|---|
| **Hero/header** | `properties` (photo, name, nickname, address, bd/ba/sleeps, lifecycle, market) | Photo, eyebrow, name, address, facts, badges | `neighborhood`, `tier`, `min_stay_months`, `year_built`, `property_type`, `listing_public_url`, `time_zone` | Fact chips read as plain text; market/neighborhood absent from the identity line where operators expect it |
| **Alert strip** | derived (conflicts, handoff, quarterly-gated) | Danger/warn/neutral rows | — | Purely textual; no action attached to any alert |
| **Guest Access & Credentials** | `property_credentials` (AES-GCM) | Masked rows, Reveal/Copy, audit | Verification age / last-verified prominence | Good; sits above the tabs so it pushes tab content below the fold |
| **Overview tab** | hub summary | Snapshot counts, owner, status | — | Duplicates hero facts and Operations tab counts |
| **Property details tab** | **two parallel builders** — `buildPropertyDetailGroups` (real JSONB) *and* legacy `sections` array | Grouped accordions (WiFi & tech, HVAC, Utilities & shutoffs, safety, waste, supplies, HOA, amenities, other) **plus** a second grid of legacy cards | — | **Direct contradiction:** the legacy grid re-asserts "Awaiting field map" for utilities/HVAC/access/safety/amenities that the groups above already show populated (§6) |
| **Contacts tab** | `property_owner_contacts` / owner record | Name, email, phone, source, match status, synced date | Mailing address, ownership %, alternate contacts | Card per contact for what is usually 1–2 rows; wasteful |
| **Onboarding tab** | `onboarding_tasks`, `handoffs` | Progress bar, stage, blockers, current tasks, handoff status | Task owners, due dates on the summary | Re-implements the Onboarding workspace at lower fidelity |
| **Operations tab** | `tickets`, `work_orders`, `BreezewayWorkOrderPanel` | Ticket list, work orders, Breezeway panel | **Utilities/waste/systems operational data (the reported gap)**, coverage/pod, SLA posture | Named "Operations" but shows only tickets — this is exactly where staff look for utilities, trash days and shutoffs |
| **Documents & Media** | `documents`, `external_links` (475 links, 3 docs) | Grouped library, quick links, category badges | — | Nearly all content is legacy links; only 3 real documents, so the library looks empty while 475 links sit in quick-links |
| **Approvals** | `approvals`, `external_records` | Awaiting owner, decision history | Approval amounts/limits | Two cards for usually-empty data |
| **Activity** | `audit_log` | Action, actor, timestamp, reason | Diff of old/new values | Raw action keys humanized, but no filtering |

Cross-cutting: 8 tabs with no counts on the tab labels, so staff must open each tab to learn whether it holds anything.

---

## 6. Utilities — data-path diagnosis

**Verdict: the data exists and is correct. Two separate presentation bugs make it look missing.**

### Where the data lives
`public.properties` carries grouped JSONB domains from the PID import: `utilities`, `waste`, `hvac`, `systems`, `parking`, `access`, `security`, `hoa`, `amenities`, `warranty`, `compliance`, `grounds`, `pool_spa`, `fireplace`, `sprinklers`, `storm_shelter`, `facts`, `external_refs`. There is no separate utilities table, and none is needed.

### Production coverage (157 non-demo properties)
| Group | Key | Properties populated |
|---|---|---|
| utilities | `wifi_split_confirmed` | 157 |
| utilities | `wifi_ssid` | 152 |
| utilities | `router_location` | 151 |
| systems | `fridge_filter` | 151 |
| systems | `smoke` | 149 |
| systems | `supply_storage` | 148 |
| systems | `water_shutoff_outdoor` | 148 |
| systems | `breaker_panel_location` | 148 |
| systems | `co` | 147 |
| systems | `supply_box_location` | 147 |
| systems | `water_shutoff_indoor` | 140 |
| hvac | `filter_notes` | 151 |
| hvac | `filter_sizes` | 124 |
| waste | `holiday_notes` / `cart_notes` / `recycling` / `trash_days` / `recycling_days` | 151 |
| waste | `cart_count` | 140 |
| waste | `valet` | 123 |

Representative rows:

- **1012 Wasatch Ct** — `utilities: {wifi_ssid: "ARHA", router_location: "Not Mentioned", wifi_split_confirmed: false}`; `waste: {trash_days: ["Tuesday","Friday"], recycling: true, recycling_days: "Friday", valet: "No", holiday_notes: "See attached photo…"}`
- **10121 E. 131st Pl. S.** — `utilities: {wifi_ssid: "ARHA 2.4 and 5.0", router_location: "In the middle bedroom just off the hallway", wifi_split_confirmed: true}`; `waste: {trash_days:["Friday"], cart_count: 2, recycling_days: "Same as trash day Friday"}`
- **1016 NW 191st St** — `waste: {valet: "Yes", cart_count: 3, trash_days: ["Tuesday"], recycling_days: "EO Tuesday"}`

### Where it renders today
`src/lib/property-details.ts` correctly maps these into groups — `wifi_tech` (`:68-81`), `hvac` (`:83-91`), `utilities_shutoffs` (`:93-102`, `own: ["utilities"]` + shutoff/breaker picks), `waste` (`:126-129`), supplies (`:154-155`), `other_systems` (`:162-165`). `loadPropertyHub` calls `buildPropertyDetailGroups` (`property-hub.server.ts:346`) and `PropertyDetailSections` renders it on the **Property details** tab. That path works.

### Root cause 1 — false "Awaiting field map" placeholder
`property-hub.server.ts:189-291` still contains the pre-import legacy `sections` scaffold, including:

```
{ id: "utilities", title: "Utilities",
  fields: [pending("Utility providers & billing responsibility", "utilities", "ARHA PID")] }   // :239-243
```

That grid renders directly beneath the real groups (`property.$propertyId.tsx:331-365`) and stamps an "Awaiting field map" badge on utilities — actively telling staff the data does not exist while the populated group sits a few pixels above. The same stale stubs exist for `building_systems` (`:226`), `access_credential_ref` / `parking` (`:235-236`) and `safety_locations` / `amenities` (`:249-250`).

**Exact minimal fix:** delete the stale entries in the legacy `sections` array in `src/lib/property-hub.server.ts` (`:239-243`, and for consistency `:226`, `:235-236`, `:249-250`). No change to `property-details.ts`, the query, or `PropertyDetailSections`.

### Root cause 2 — the Operations tab never queries it
`OperationsTab` (`property.$propertyId.tsx:509-…`) reads only `hub.operations.tickets`, `hub.operations.workOrders` and `BreezewayWorkOrderPanel`. It does not read `hub.details.groups` at all. So the tab a coordinator opens for "how does this house run" contains no utilities, waste, shutoff or HVAC information by design.

**Exact minimal fix:** render the already-loaded operational groups (`utilities_shutoffs`, `waste`, `hvac`, `wifi_tech`, supplies) inside `OperationsTab` from `hub.details.groups` — a read of data already on the page, no new query, no schema change, no workflow change.

### Not causes
- Nothing is hidden by empty-state or placeholder filtering — the groups render.
- The server query is `select("*")`; the columns are fetched.
- No binding is broken and no data is missing. No migration or overwrite is warranted.

---

## 7. Seats & Coverage complexity analysis

`/team` stacks **8 top-level blocks**, one of which contains 3 sub-cards, plus one card per functional role — realistically **10+ distinct card blocks** before the per-role grid.

| # | Block | Reads | Editable | Verdict |
|---|---|---|---|---|
| 1 | `TeamInvitePanel` | `team_invites` | create / revoke / resend | Keep, but belongs under Access, not Coverage |
| 2 | `TeamAccessPanel` | `profiles` + `user_roles` | permission role, password reset | Keep, Access |
| 3a | `CoverageSchedulePanel` → SeatsCard | `functional_roles`, `coverage_shifts`, `coverage_overrides` | seat holder, add/delete shift, add/delete override, availability | Keep — this is the real system |
| 3b | → TriageCard | `coverage_triage_windows` | **read-only** | Config with no admin surface |
| 3c | → OnCallCard | `oncall_roster` + `coverage_config` | add/edit/delete date ranges | Keep |
| 4 | `AssignmentExceptionQueue` | `tickets` (unassigned + assignment_note) | read-only | Symptom of coverage gaps; belongs on Oversight |
| 5 | `OwnerDirectoryPanel` | owner-directory stats | sync primary owners | **Unrelated to seats** — accretion |
| 6 | `VendorScoreboardPanel` | vendor scoreboard fn | read-only | **Unrelated to seats** — accretion |
| 7 | Inline role grid + `SeatEditor` | `functional_roles`, `profiles`, `tickets` | seat holder, `coverage_window`, `lunch_window`, `lunch_coverage` (direct Supabase update) | **Duplicate seat-holder editor** |
| 8 | "Single-PC coverage rule" card | static text | — | Policy copy |

### Duplication
- **Seat holder can be set in two different UIs through two different code paths**: the inline `SeatEditor` (`team.tsx:227-247`, direct table update) and `CoverageSchedulePanel`'s `setSeatHolder` server function. They can disagree.
- **Two representations of "when is this seat on duty"**: the free-text `functional_roles.coverage_window` / `lunch_window` strings and the structured `coverage_shifts` rows. Routing uses the structured rows; the free text is display-only and can drift.
- **Five coverage mechanisms in different shapes**: weekly shifts (weekday + minutes), overrides (datetime ranges), triage windows (weekday + minutes), on-call roster (date ranges), free-text windows.

### What must stay editable
Seat holder, recurring shifts, temporary overrides, seat availability, on-call assignments — plus triage windows should *become* editable rather than stay DB-only.

### Consolidation target
One **weekly coverage calendar**, seats as rows, Mon–Sun as columns, Central Time, with layered tracks:
1. base recurring shift block per seat (`coverage_shifts`),
2. override chips drawn on top of the affected day (`coverage_overrides`),
3. a triage band showing approved cross-team windows (`coverage_triage_windows`),
4. an all-day on-call banner row (`oncall_roster`),
5. an after-hours 22:00–08:00 shaded region from `coverage_config`.

Above it: a compact seat roster strip — seat name, holder avatar/name or an "Invitation pending" chip, on/off duty right now. Click any block to edit in place. That single view replaces blocks 3a/3b/3c and removes block 7 entirely; blocks 1 and 2 move to an "Access" tab; blocks 4, 5 and 6 leave the page. No routing logic changes.

---

## 8. Visual design-system audit

### Current tokens (`src/styles.css`)
- **Typography:** `Carlito, Calibri, ui-sans-serif` for both display and sans — one family, no contrast. Headings `-0.015em` tracking. No formal type scale; sizes are chosen per page.
- **Background:** Warm Ivory `oklch(0.97 0.007 88.6)` / dark Ink `oklch(0.199 0.01 220)`.
- **Card/surface:** pure white `oklch(1 0 0)` / dark Charcoal `oklch(0.27 0.013 222.5)`.
- **Primary:** Deep Teal `oklch(0.511 0.082 201.5)` / dark ARHA Teal `oklch(0.72 0.108 203.1)`.
- **Accent:** Burnt Orange `oklch(0.61 0.137 48.4)`. **Brand triad:** teal / gold / ink.
- **Text:** foreground ink; muted Slate `oklch(0.545 0.014 223.7)`.
- **Border/input:** light hairline; dark `oklch(1 0 0 / 13%)`.
- **Semantic:** success / warning / danger / info defined for both themes.
- **Radius:** single `--radius: 0.375rem` with derived sm/md/lg/xl/2xl/3xl/4xl.
- **Elevation:** exactly two — `--shadow-card`, `--shadow-raised`.
- **Utilities:** `surface`, `surface-row` (hover tints border + raises shadow), `eyebrow`, `numeric` (tabular figures). Global `:focus-visible` ring.
- **Spacing:** no documented scale; pages use ad-hoc `space-y-3/4/6` and `p-3/4/6`.

### Same component, different styling
- **Two competing card languages.** `SectionCard` (`surface`, `rounded-lg`, `shadow-card`, tone-aware border) is imported by **2 files**; the raw shadcn `Card` (`rounded-xl`, `shadow`, `p-6`) is imported by **~69 files**, including every panel on `/team` and the whole Property Hub. Different radius, different shadow, different padding — visible side by side on the same page.
- **Hand-rolled mini-cards** reinvent `surface`: `OwnerDirectoryPanel.tsx:87`, `CoverageSchedulePanel.tsx:334,563,569`, `team.tsx:250`, and `AssignmentExceptionQueue.tsx:58` (a manual `surface-row` that misses the hover shadow escalation).
- **Badges have no semantic variants.** `badge.tsx` offers only default/secondary/destructive/outline despite success/warning/danger tokens existing, so every status badge overrides className: `team.tsx:127` (`border-danger/40 bg-danger/10 text-danger`), `TeamAccessPanel.tsx:90` and `TeamInvitePanel.tsx:189` (`uppercase` outline), `VendorScoreboardPanel.tsx:42` (ternary variant). `vendor.$ticketId.tsx:190` and `vendor.index.tsx:33` hardcode `bg-amber-500 text-white` — outside the token system entirely.
- **Headings:** `text-3xl` (`audit`, `oversight`, `playbooks`, `command-center`), `text-3xl md:text-4xl` (`hub`), `text-2xl` (`integrations`, `map`, `ops-analytics`, `owner-analytics`, `owner`), plain `text-lg` sub-headings (`team.tsx:111`) — none routed through `PageHeader`.
- **Empty states:** `EmptyState` exists (dashed, `rounded-lg`, `bg-muted/30`, `py-10`, icon slot) but `TeamInvitePanel.tsx:164-166` hand-rolls `rounded-md border-dashed p-4`.

### Why it reads beige, flat and remedial
1. **One background tone everywhere.** Warm ivory page + white cards is the entire palette of most screens. Nothing distinguishes Home from Tickets from Team — no section tinting, no colored header band, no imagery.
2. **Brand color is used only in 16px doses** — an icon, an underline, a rail. Teal never appears as a surface, so the brand never registers.
3. **Two shadows and one 6px radius across every element** means genuine hierarchy (a critical escalation vs. a static policy card) is carried only by text size, which is itself inconsistent.
4. **Single typeface, no display face, no scale discipline** — headings read as bold body text.
5. **Density is uniformly loose.** A 157-row portfolio, a ticket queue and a two-field policy card all get the same `p-6` cards, so pages feel padded rather than operational.
6. **Muted slate is doing too much work** — labels, hints, metadata and secondary values are all the same grey, so scanning has no rhythm.

The remedy is not more color. It is: a second surface tone for page bands, brand teal used deliberately as a header/hero field, a real type scale with one display face, tighter operational density, semantic badge variants, and one card component instead of two.

---

## 9. Redesign ranking

**A — Strong, preserve direction**
- **Properties** — real photography, honest data, scannable card rhythm. The one page that looks like a product. (Needs local search and pagination, not a redesign.)
- **Guest Access & Credentials panel** — clear, secure, purposeful.
- **Ticket detail** — the workflow reads correctly end to end.

**B — Needs refinement**
- **Tickets queue** — priority rail and density are right; needs saved views, counts on tabs, and a calmer filter bar.
- **Onboarding** — architecture is sound; stage/progress hierarchy and blocker prominence need work.
- **Active Owner (owner + owner-programs)** — content is right, presentation is generic; needs the "premium program" treatment.
- **Property Hub** — strong hero, but 8 unlabeled tabs, duplicated sections and the stale placeholder grid undercut it.
- **Oversight** — useful buckets, wrong nav group, plain presentation.

**C — Needs meaningful redesign**
- **Home (`/dashboard`)** — role-blind, no brand presence, four grey tiles above a list. It is the first thing the team sees and the weakest page.
- **Public overview (`/`)** — no hero imagery at all despite 156 property photos available; pure text and card grids.
- **Seats & Coverage (`/team`)** — 10+ stacked blocks, a duplicate seat editor, two representations of "on duty", and three unrelated panels. Structurally, not cosmetically, wrong.
- **Hub (`/hub`)** — redundant with Home for most staff.
- **Help (`/welcome`)** — static placeholder content in production.

*(Analytics, Ops performance, Owner analytics and Command Center are intentionally excluded — deferred to the end of the project.)*

---

## 10. Proposed target UI architecture (not built)

### Home — `/dashboard`
- **Purpose:** in five seconds, tell this person what is on fire, what is theirs, and where to go.
- **Above the fold:** a brand band — teal field, ARHA Resolve mark, "Keep calm. Check Resolve.", the person's name and seat, current duty status (on shift / after-hours / on-call holder), and today's date in Central. Beneath it, one row of three live tiles scoped to the viewer.
- **Primary action:** Log a ticket.
- **Secondary:** Open my queue · Find a property.
- **Sections:** (1) Needs me now — my assigned + unacked, (2) Escalations (Supervisor+ only), (3) Coverage right now — who holds each seat this hour, (4) Shortcuts.
- **Role split:** Coordinator sees their own work and coverage. Supervisor additionally sees escalations, unassigned, and SLA breach. Director/Admin sees a portfolio strip.
- **Remove/consolidate:** fold `/hub` into a portal switcher in the header; Home becomes the single entry point.

### Tickets — `/tickets`
- **Purpose:** triage and work the queue.
- **Above the fold:** header with live counts, saved-view tabs (Mine · Unassigned · Escalated · Team · All) with counts on the tabs, one search field, one filter row.
- **Primary:** Log a ticket. **Secondary:** switch view, filter, map toggle (absorbing `/map`).
- **Hierarchy:** priority rail + P1/P2/P3 label, then title, then property, then assignee + SLA clock right-aligned in tabular figures.
- **Remove:** the separate Work map nav item.

### Properties — `/properties`
- **Purpose:** find a home fast; see portfolio health.
- **Above the fold:** header, **"Find a property"** search (name, address, market, neighborhood, owner, OwnerRez ID), market/lifecycle filter chips, result count.
- **Primary:** open a property. **Secondary:** Import from OwnerRez · Refresh photos · Add property (moved into an overflow menu — three competing primary buttons today).
- **Sections:** result grid (preserve current card design), paginated or windowed.

### Property Hub — `/property/$id`
- **Purpose:** the whole operating history of one home.
- **Above the fold:** hero photo, name/nickname, address, market · neighborhood, lifecycle badge, bd/ba/sleeps, owner, and Guest Access & Credentials collapsed to a single secure strip with Reveal.
- **Primary:** Log a ticket for this home. **Secondary:** Upload document · Open onboarding · Contact owner.
- **Tabs (with counts):** Overview · Operations · Details · Documents · Onboarding · Contacts · Approvals · Activity.
- **Operations tab gains the operational reality:** utilities & shutoffs, waste/trash days, HVAC filters, WiFi, supply storage — alongside tickets and work orders (§6).
- **Remove:** the legacy `sections` placeholder grid entirely; fold Overview's duplicated facts into the hero.

### Seats & Coverage — `/team`
- **Purpose:** a Supervisor sees who is on, who is off, and who covers the gap — in seconds.
- **Above the fold:** "Right now" strip — each seat, holder or "Invitation pending", on/off duty, plus tonight's on-call.
- **Below:** one **weekly calendar**, seats × Mon–Sun, Central, with layers for recurring shifts, overrides, triage bands, on-call banner and the shaded 22:00–08:00 after-hours region. Click a block to edit in place.
- **Primary:** Edit this week's coverage. **Secondary:** Assign seat · Add override · Set on-call.
- **Tabs:** Coverage | Access (invites + permissions).
- **Remove:** the inline duplicate `SeatEditor`, the free-text coverage/lunch fields, the Owner Directory panel, the Vendor Scoreboard panel, and the Assignment Exception queue (move to Oversight).

### Onboarding — `/onboarding`
- **Purpose:** move each home from contract to launch.
- **Above the fold:** project header with stage stepper, percent complete, days in stage, handoff status, blocker count.
- **Primary:** advance the current task. **Secondary:** request handoff · add note · apply template.
- **Sections:** stage stepper → tasks grouped by stage with subtasks nested and indented → blockers pinned above → handoff gate as a distinct terminal card.
- **Remove:** duplication with the Property Hub Onboarding tab — the Hub tab becomes a read-only summary that links here.

### Active Owner — `/owner` and `/owner-programs`
- **Purpose:** make participation feel like a program, not a timesheet.
- **Above the fold (owner):** a progress hero — hours approved vs. 90-day target as a single prominent ring or bar, days remaining, pace ("on track" / "behind"), next milestone.
- **Primary:** Log participation time. **Secondary:** Download report (PDF/CSV) · View my properties.
- **Sections:** milestones as a horizontal track, reported-vs-approved kept visually separate (approved solid, pending outlined), entry history, property attribution.
- **Internal view:** same hero language, plus the review queue as the primary action.
- **Remove:** generic card stacking; nothing about the rules changes.

### Team (access)
- Folded into `/team` as the **Access** tab: one people table — name, seat, permission role, invite status, last active — with row-level actions. Replaces two separate panels.

*Analytics, Insights and Reports are deliberately excluded from this recommendation and deferred to the end of the project.*

---

## 11. Where the prior polish pass failed to change the team experience

1. **It styled components, not pages.** New primitives (`SectionCard`, `EmptyState`, `StatTile`) were created but adopted in only 2 files; ~69 files still use the raw shadcn `Card`, so two card languages now coexist and the app looks *less* consistent in places, not more.
2. **It never touched composition.** Home is still four grey tiles over a list; the Property Hub still has 8 flat tabs; `/team` still stacks 10 blocks. Layout was the problem and layout was not changed.
3. **It did not address role.** Home renders identically for a coordinator and a Supervisor, so neither audience feels the page was built for them.
4. **It added no brand surface.** Teal remained a 16-pixel accent on an ivory page; no hero, no header band, no imagery — despite 156 real property photos and brand assets already in the repo.
5. **It left contradictions in place.** The Property Hub still tells staff utilities are "Awaiting field map" while showing the utilities right above it. No amount of styling fixes a page that argues with itself.
6. **It did not remove anything.** Polish added surface treatment on top of accumulated duplication (two seat editors, two detail builders, four analytics pages, three homes). Cohesion requires subtraction, which this pass did not do.
