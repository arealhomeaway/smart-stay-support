# OwnerRez ↔ Resolve — Integration Capability Audit (read-only)

Date: 2026-09-01 (America/Chicago). No writes were made to OwnerRez. No Resolve code changed.
All findings below were verified live against the connected account except where marked "documented".

---

## 1. Authentication

| Item | Finding |
| --- | --- |
| Method | HTTP Basic — OwnerRez login email + **Personal Access Token** (`src/lib/ownerrez.server.ts`) |
| OAuth | **Not used today.** No OAuth app, no client id/secret, no refresh architecture |
| API version | v2, base `https://api.ownerreservations.com/v2` |
| Token storage | Server-side environment secrets (`OWNERREZ_USERNAME`, `OWNERREZ_ACCESS_TOKEN`), read only inside server functions. Never sent to the browser |
| Account reached | Company **A Real Home Away**, API user Josh Dunham (`bookings@…`), time zone America/Chicago, 157 properties |
| Rate-limit handling | **None.** OwnerRez returns no rate headers on these calls; Resolve has no 429 backoff, no retry, no request budget |
| Error handling | Single wrapper: logs status + body server-side, converts 401 to a readable message, throws `OwnerRezError`. Callers degrade to "verify in OwnerRez" rather than failing the page. No retries |
| Caching | **None.** Every guest/stay panel is a live call on each view (`staleTime` 60s in React Query only) |

**Material risk:** guest/stay lookups are un-cached, un-retried live calls on ticket pages. At today's volume this is fine; it is the first thing that breaks under load or a Microsoft/OwnerRez blip.

---

## 2. Endpoints currently used

| Endpoint | Method | Purpose | R/W | Resolve feature | Cadence | Cached | Mechanism |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/properties` (paged, `includeInactive`) | GET | Listing list + facts, photo, owner id, geo | R | Property import, Property Hub enrichment | Manual button | Yes → `properties` + provenance | Manual |
| `/owners` | GET | Designated owner records | R | Owner directory import | Manual | Yes → `property_owners` | Manual |
| `/bookings` (`property_ids`,`from`,`to`,`include_guest`) | GET | Today's stay for a home | R | Ticket creation occupancy, Guest Context, Property Contact | Every view | No | Live |
| `/guests/{id}` | GET | Guest name/phone/email | R | Guest Context, Property Contact | Every view | No (deliberate — no guest copy stored) | Live |
| `/tasks` | GET | Maintenance tasks → tickets | R | `syncOwnerRezInbound`, cron `/api/public/sync/inbound` | Scheduled | Writes tickets | Polling |

**`/tasks` returns 404 on this account** — the scheduled inbound sync is dead code in practice; zero tickets exist with `external_source='ownerrez'`.

Not used at all today: `/inquiries`, `/quotes`, `/listings`, `/reviews`, `/listingsites`, `/webhooksubscriptions`, `/messages`.

---

## 3. Property data coverage

Stored + displayed today (157/157 homes linked by `ownerrez_property_id`; 156 carry `ownerrez_owner_id`):
OwnerRez id, name, street/city/state/postal, bedrooms, bathrooms, sleeps (`max_guests`), living area, property type, check-in/check-out, time zone, public listing URL, primary photo (3 sizes), lat/long (only when Resolve had none), owner link. Every field carries provenance and a synced-at stamp.

Available through the API but **not surfaced**:

| Field | Source | Verdict |
| --- | --- | --- |
| `active` / `is_snoozed` (listing live or paused) | `/properties` | **Surface** — operationally meaningful |
| `external_name` (listing nickname, e.g. "Foxtail Hollow (1399)") | `/properties` | **Surface** — staff search by this name |
| `max_pets`, `bathrooms_full/half` | `/properties` | Surface (low cost, inside existing enrichment) |
| Amenities, occupancy min/max, sleeps-in-beds, cancellation policy, review average/count, space type | `/listings` | **B** — useful, second pass |
| `tags`, custom `fields` | `/properties/{id}` | Needs a decision; likely overlaps PID data |
| Channel/listing-site catalogue | `/listingsites` | C |
| Minimum-stay / rates / availability calendar | **Not exposed** on this account (`/spotrates` 405, no rules or availability endpoint) | D — OwnerRez-only |
| Full photo gallery | **Not exposed** (no photos endpoint; only the 3 thumbnail URLs) | D |

PID/operational fields are untouched by enrichment — identity fields (name, address) are never rewritten. That boundary is correctly implemented and should stay.

**Gap found:** `property_owner_contacts` is **empty (0 rows)** while `property_owners` holds 116 owners and 156 homes are linked. The Property Contact panel reads the empty table, so every home reports "not synced" for its owner even though the data exists. This is a binding bug, not missing data.

---

## 4. Reservation and guest context

Available on `/bookings` (verified): id, property_id, arrival, departure, check_in/check_out times, adults/children/infants/pets, status, type, `is_block`, **`listing_site` (Airbnb/Vrbo/direct)**, **`platform_reservation_number`** (the channel's own confirmation code), `quote_id`, **`thread_ids`**, booked/created/updated UTC, total_amount, total_paid, total_host_fees, currency, guest object, owner_id, charges (on single fetch), cancellation policy, travel insurance.

Resolve surfaces today: guest name, phone, arrival, departure, reservation id, channel, short/mid-term classification — on Ticket detail (Guest Context) and Property Contact. Ticket creation stores `ownerrez_booking_id` (only 8 of 443 tickets have one).

**Fields staff currently open OwnerRez to see, that Resolve could safely show:**
- `platform_reservation_number` (the code guests and Airbnb/Vrbo support quote)
- guest count (adults/children/pets) — drives cleaning and access decisions
- booking status (active/cancelled) and booked date
- next arrival after the current stay (already computed in `stayForListing`, not displayed on the ticket)
- guest email (fetched, then dropped)
- a **link straight to the booking in OwnerRez**

Not recommended for Resolve: payment amounts, charges, host fees. Operationally unnecessary, and it turns Resolve into a financial surface it is not governed as.

---

## 5. Deep links

Verified by request shape (all redirect to OwnerRez login with a `returnUrl`, i.e. the routes exist and resolve after sign-in):

| Target | Link | Reliable? |
| --- | --- | --- |
| Booking | `https://app.ownerrez.com/bookings/{booking_id}` | **Yes** |
| Property | `https://app.ownerrez.com/properties/{property_id}` | **Yes** |
| Guest | `https://app.ownerrez.com/guests/{guest_id}` | **Yes** |
| Inquiry | `https://app.ownerrez.com/inquiries/{id}` | **Yes** |
| Quote | `https://app.ownerrez.com/quotes/{id}` | **Yes** |
| Message thread | `https://app.ownerrez.com/messages/{thread_id}` | **No — 404.** Do not build |
| Public listing page | `public_url` from the API | Yes (already stored) |

Conversation deep-linking is the one link we cannot generate reliably. The honest substitute is **Open Booking in OwnerRez** — the booking screen is where staff reach the conversation.

---

## 6. Messaging — the decisive finding

OwnerRez generally supports guest messaging over the API: list messages, retrieve a message, send a message, and every booking/inquiry/quote we read carries `thread_ids`.

**ARHA Resolve is not authorized for any of it today.** `GET /v2/messages/{thread_id}` returns:

```
402 payment_required — code: messaging_not_enabled
"Messaging endpoints require an OAuth app. Personal Access Tokens do not support messaging.
 If you're accessing your own account, self-use is included — create an OAuth app and
 click Grant Access To Me on the Users tab."
```

So, precisely:

| Capability | OwnerRez generally | ARHA Resolve today |
| --- | --- | --- |
| Auth type | OAuth 2.0 or PAT | PAT only |
| List threads / read messages | Yes (OAuth) | **No — 402** |
| Newest message, sender, timestamp, channel | Yes (OAuth) | No |
| Attachments | Documented, unverified | No |
| Send/reply (Airbnb, Vrbo, direct email, SMS) | Yes (OAuth) | **No** |
| Messaging webhooks | **No such category exists** (see §7) | No |

**Unblocking is configuration, not purchase**: create an OwnerRez OAuth app and use "Grant Access To Me" for self-use. That is an ARHA-side action in the OwnerRez account, and it changes the auth architecture (token exchange + refresh), which is why it is not a Phase 1 item.

---

## 7. Webhooks

Resolve has **zero** OwnerRez webhook subscriptions (`GET /webhooksubscriptions` → `count: 0`). Everything today is live-on-view or manual refresh.

Categories the account can actually subscribe to (verified live):

- **Property**: rates, surcharges, taxes, rules, availability, descriptions, location, rooms, photos
- **Contact**: info
- **Booking**: agreement, availability, canceled, charge, dates, doorcode, financial, notes, payment, property, time, transaction

**There is no messaging, inquiry or quote webhook category.** Any messaging or lead-inquiry freshness would have to be polled.

Where webhooks would materially help: `booking.dates`, `booking.canceled`, `booking.doorcode`, `booking.property`. Those are exactly the changes that invalidate a ticket's stay context or an access code mid-work. Resolve already has a proven webhook pattern (Breezeway, Outlook): `/api/public/hooks/*`, signature/secret check, durable event row, idempotency by external id, replay-safe.

---

## 8. Recommended messaging UX

- **Level 1 — build this.** On tickets with a linked reservation: guest, channel, stay dates, guest count, platform confirmation number, and **Open Booking in OwnerRez**. No new permissions, no new auth.
- **Level 2 — only after OAuth.** A compact read-only "Recent guest communication" strip (last 2–3 messages, sender, timestamp, channel). Officially supported, but requires the OAuth switch and polling (no webhook exists).
- **Level 3 — recommend against, for now.** Sending from Resolve is technically supported under OAuth, but it splits the guest conversation across two systems and puts channel-compliance risk (Airbnb/Vrbo messaging rules) inside an internal ops tool. It does not reduce work enough to justify that.

---

## 9. Ticket ↔ OwnerRez

Automatable today, with no new permissions: a ticket can carry property, reservation id, guest name, channel, platform confirmation number, stay dates and a booking deep link — captured **at creation** from the live stay lookup and **frozen on the ticket** (today only `ownerrez_booking_id` is stored, and rarely).

Not automatable: thread reference (402), and inbound "guest message → ticket" (no messaging read, no messaging webhook). That is consistent with the stated intent — Resolve should not create work from every guest message. The human trigger stays: a coordinator logs a ticket, and Resolve attaches the reservation context automatically.

---

## 10. Leads ↔ OwnerRez

- Inquiries are readable (`/inquiries`: property, dates, guests, `listing_site`, comments, `guest_id`, `thread_ids`) — a Lead can reference an OwnerRez inquiry id and deep-link to it.
- Quotes are readable (`/quotes`: dates, guests, expiry, notes, `listing_site`) — read-only context only. Quote creation exists in the API but should stay in OwnerRez.
- Availability/rates are **not** exposed on this account, so Resolve cannot answer "is it free?" — candidate-property matching stays judgement plus OwnerRez.
- Conversion: `leads.reservation_ref` already exists and is unused. On conversion, accept an OwnerRez booking id, verify it with a single `GET /bookings/{id}`, and store id + property + arrival/departure + channel. Verified linking, not guessed.

---

## 11. API boundary (read/write capability)

| Action | Possible on this connection | Recommendation |
| --- | --- | --- |
| Read inquiries / quotes / bookings / guests / properties / listings / reviews | Yes | Use for context |
| Read availability / rates / min-stay | **No** (not exposed) | OwnerRez-only |
| Create quotes, create/modify/cancel bookings | Documented as supported (POST/PATCH) — **not attempted** | **Do not build.** OwnerRez stays the execution system |
| Send messages | No (402) | See §6 |

**Agreement:** yes — Resolve provides context and workflow; OwnerRez executes PMS actions. The one place I'd disagree with a strict "never write" line is far later and narrow: nothing in this phase.

---

## 12. Daily workflow

- **Primarily Resolve:** tickets, ownership/handoffs, SLAs, internal notes, credentials, work orders, onboarding projects, leads pipeline, vendor performance, property operational data.
- **Primarily OwnerRez:** all guest and channel messaging, booking changes, cancellations, quotes, direct-booking execution, rates/availability, financials.
- **View in Resolve, act in OwnerRez:** reservation/stay context on a ticket, guest identity and channel, property listing facts and photo, owner identity, inquiry/quote context on a lead. Each of these gets an "Open in OwnerRez" escape hatch rather than an editor.

---

## 13. Property lookup

Use Resolve for: address, bedrooms/baths/sleeps, check-in/out, time zone, owner, access credentials, utilities, operational history, documents, photo. Already there.
Add to Resolve: listing nickname (`external_name`), active/snoozed status, pets allowed, amenities (Phase 2).
Stays OwnerRez-only: rates, availability calendar, min-stay rules, channel listing configuration, full photo gallery, financials.

---

## 14. Data authority matrix

| Domain | System of record | View in | Act in |
| --- | --- | --- | --- |
| Property identity (name, address, id) | OwnerRez | Resolve | OwnerRez |
| Property operational data (access, utilities, notes) | Resolve | Resolve | Resolve |
| Owner | OwnerRez | Resolve | OwnerRez |
| Reservation | OwnerRez | Resolve (context) | OwnerRez |
| Guest | OwnerRez | Resolve (context) | OwnerRez |
| Inquiry | OwnerRez | Resolve (link) | OwnerRez |
| Quote | OwnerRez | Resolve (link) | OwnerRez |
| Booking execution | OwnerRez | OwnerRez | OwnerRez |
| Channel / listing config | OwnerRez | OwnerRez | OwnerRez |
| Guest communication | OwnerRez | OwnerRez (Resolve later, read-only) | OwnerRez |
| Credentials | Resolve | Resolve | Resolve |
| Documents | SharePoint / Resolve | Resolve | Resolve |
| Tickets | Resolve | Resolve | Resolve |
| Leads | Resolve | Resolve | Resolve |
| Work Orders | Resolve (Breezeway transitional) | Resolve | Resolve |

---

## 15. Identifier mapping (idempotency)

| Entity | Durable id | Stored in Resolve | Unique constraint |
| --- | --- | --- | --- |
| Property | OwnerRez property id | `properties.ownerrez_property_id` (157/157) | Not enforced by index — **should be** |
| Owner | OwnerRez owner id | `properties.ownerrez_owner_id`, `property_owners.source_owner_id` | De-duplicated in code |
| Booking | OwnerRez booking id | `tickets.ownerrez_booking_id` (8 rows) | None needed (context, not a record) |
| Guest | OwnerRez guest id | **Not stored** — deliberate, no guest copy | n/a |
| Inquiry / Quote | ids exist | Not stored | Would need `leads` columns |
| Thread | `thread_ids` on bookings | Not stored | Blocked by 402 |

Property import currently falls back to **matching by name** when no OwnerRez id is set — that is the one path that could create or mis-link a property. It should be tightened to id-only matching before any future sync work.

---

## 16. Improvement classification

**A — high value / low risk**
1. Reservation context frozen onto tickets at creation (booking id, guest, channel, platform confirmation number, stay dates, guest count).
2. "Open Booking / Property / Guest in OwnerRez" deep links.
3. Fix the empty `property_owner_contacts` binding so owner context actually shows.
4. Surface listing nickname + active/snoozed on the Property Hub.
5. Lead conversion → verified OwnerRez reservation link.

**B — after the core**
6. Booking webhooks (dates, canceled, doorcode, property) for freshness.
7. Amenities / occupancy / cancellation policy from `/listings`.
8. Inquiry + quote context on leads.
9. Caching + 429 backoff on OwnerRez reads.

**C — possible, unnecessary**
10. Full guest/reservation mirror in Resolve. 11. Reviews. 12. Financials. 13. Listing-site catalogue. 14. Reviving the dead `/tasks` sync (404 on this account — remove it instead).

**D — OwnerRez-only**
Rates, availability, min-stay, booking creation/modification/cancellation, quote creation, channel configuration, and — for now — guest messaging.

---

## 17. Phases

**Phase 1 (no OwnerRez configuration required):** items 1–5 above, plus removing the dead `/tasks` sync.
**Phase 2:** booking webhooks, caching/backoff, `/listings` enrichment, inquiry/quote context on leads.
**Phase 3 (requires ARHA to create an OwnerRez OAuth app + "Grant Access To Me"):** read-only recent guest communication. Sending stays out of scope until it clearly earns its place.

This matches your proposed structure, with one change: **the owner-contact binding fix belongs in Phase 1** — it is a live gap, not an enhancement.

---

## 18. OwnerRez-side configuration required

- **Phase 1 and 2: nothing.** No new permissions, no plan change.
- **Phase 3 only:** an OwnerRez OAuth app created in the ARHA account, with "Grant Access To Me" on the Users tab (self-use, no OwnerRez support ticket, no additional cost per their error message). This replaces PAT auth for messaging calls and introduces token refresh.

## Recommended first build

**Reservation context + reliable deep links on tickets** (A1 + A2), with the owner-contact binding fix (A3) alongside it, because it is the same panel. Smallest change, removes the most OwnerRez round-trips per day, requires no new permission, and is fully reversible.
