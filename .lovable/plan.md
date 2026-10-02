# Operations Pass 2 — Work Entry Model

Navigation Pass 1 stays as it is. Onboarding, Active Owner, Finance, Claims, Reviews/Surveys, Departure Review, Quote Calculator and vendor workflows are not touched.

## What users will see

**1. One entry screen, three choices.** "Report an issue" becomes a chooser with three cards: **Log Property Activity**, **Create Ops Ticket**, **Report Maintenance**. It opens in the same side panel from My Work, a property page, Home and the queues. Opened by its address, it is a full page with Back. Each card leads to its own short form. Nothing stops with "Pick a work type" any more: the card you pick sets the main type. Resolve can still suggest a more specific category, but if it can't, you can still save.

**2. Log Property Activity (not a Ticket).** This replaces "One-touch resolution". It asks for: property, when it happened, category (Guest, Cleaner, Vendor, Property condition, Access / lock, Delivery / package, Administrative, Other), what happened, what was done, who was involved, and optional attachments. Resolve records who logged it and when. Saving puts it in Property History only. It never appears in My Work, has no status, no response clock, no close step, and no handoff, escalation or waiting.

**3. Create Ops Ticket.** Asks for property, a short title, a description, priority (only if your role allows it today) and a category from the existing Guest / Admin / Access / Quality / Owner work types. After that, the existing Ticket screen runs as it does now, including ownership, handoff, escalation, Waiting, history and close approval.

**4. Report Maintenance.** Asks for property, what's wrong, category (Plumbing, Electrical, HVAC, Appliance, Lock / access, Furniture, Structural, Roof, Water intrusion / leak, Exterior / yard, Internet / technology, Other), urgency, guest impact, whether a guest is affected right now, **Potential insurance-related event (Yes / No / Unsure)**, estimated cost if known, and photos. It then uses the existing Ticket and Work Order flow. Vendor sourcing and the claims process are not changed.

**5. Owner details only when they're relevant.** Ordinary Ops Tickets no longer show owner contact details. A Maintenance Ticket shows a small Owner box (View Owner, Email Owner, Request Owner Approval) only when:
- the estimated or actual cost is above the owner approval limit ($350 today), or
- the insurance question is answered Yes or Unsure.

The buttons use the existing owner email and owner approval tools. The limit comes from the single Maintenance Authority Policy that Work Orders already use, including any recorded contract exceptions. No second approval rule is created.

**6. Insurance-risk flag.** An answer of Yes or Unsure puts an "Insurance risk" badge on the Ticket and on the Supervisor attention band, and records a history entry. Unsure is handled the same way as Yes. Nothing is filed and no one is notified automatically.

**7. Property History.** Each entry gets a clear label: **Property Activity**, **Ticket**, **Maintenance**, or one of the existing event types. Property Activity entries show what happened, what was done, who logged it and when. They are never counted as open Tickets.

**8. Old one-touch records.** Nothing is deleted or converted. Any existing one-touch records stay where they are and appear in history as "Legacy one-touch activity".

## Technical details

- **New table `property_activity_log`:** id, property_id, occurred_at, category (check list), what_happened, outcome, involved, logged_by default auth.uid(), created_at, is_demo. GRANTs to authenticated and service_role; RLS lets internal staff insert and read; append-only, so no update or delete. Attachments reuse the existing attachments system with a new `property_activity` owner kind.
- **New nullable columns on `tickets`:** `entry_kind` ('ops' | 'maintenance'), `maintenance_category`, `insurance_risk` ('yes' | 'no' | 'unsure'), `estimated_cost` numeric. `guest_impact` and `guest_in_residence` already exist and are reused. A trigger writes ticket_activity whenever insurance_risk changes. Old rows stay null and keep working as they do now.
- **Pure helpers in `src/lib/work-entry.ts`:** entry kinds, both category lists, and `ownerSectionRelevant(ticket, policy)`, which reads `MAINTENANCE_POLICY.ownerApprovalThreshold` and existing Work Order costs. Unit-tested.
- **Entry screen:** `tickets.new.tsx`'s `NewTicketForm` gets a `kind` step with three paths. Ops and Maintenance go through the existing create logic, so there is one implementation. The one_touch mode is removed from new entry, but `RECORD_TYPES` and its display labels stay so legacy records still render. The Activity form is a small new component inside the same form shell. The drawer already hosts `NewTicketForm`.
- **Ticket screen:** a new compact `TicketOwnerBox` shows only when relevant. Existing owner contact blocks are gated behind the same helper. `OwnerApprovalPanel` / `prepare_work_order_owner_approval` are reused.
- **Property page:** the existing history list on `property.$propertyId.tsx` merges `property_activity_log` rows and adds type labels. Open counts query tickets only.
- **Tests:** unit tests for the helpers and the entry choice, the full suite, and browser checks A–J on the demo property with synthetic data, archived afterwards. Nothing is published.

## Decisions to confirm
1. **Who can log Property Activity?** The plan says all internal staff (Coordinators, Supervisors, Admin, Onboarding). Vendors and homeowners cannot.
2. **Can Supervisors see owner details on an ordinary Ops Ticket** (for example, an owner-related guest complaint), or are they hidden for everyone unless the Maintenance triggers apply? The plan says hidden for everyone, with "View Owner" still available from the property page.
