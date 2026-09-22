# Match the portal to the Welcome Packet

I read the Welcome Packet and the one-pager against what the homeowner portal does today. Most of the promise is already built — the eight request categories from page 4 are exactly the ones the portal uses, the participation log, approvals, shared files, progress meters and the Day-90 clock all exist. Four things the packet promises are not in the portal yet.

## 1. "Your journey at a glance"

The packet shows the homeowner six named milestones: Initial Onboarding, Design Alignment, Setup Progress, Owner Handoff, First Confirmed Booking, Day-90 Review.

Add a journey strip to the homeowner hub showing all six, with the current one highlighted and finished ones marked done. The stage is derived from what is already tracked (onboarding progress, handoff acceptance, first confirmed booking, day in program) — no new data entry for staff.

## 2. Deadlines in Central Time, and "silence is not approval"

The packet states deadlines are administered in Central Time and that silence is not approval. Today a request shows "Needed by Oct 3" with no timezone and no consequence stated.

- Show every owner deadline as a Central Time date, labeled as such.
- Each open request that has passed its date shows an overdue marker rather than sitting silent.
- The requests section carries the packet's line: a response is needed — silence is not approval.

## 3. What happens after Day 90

The packet tells the homeowner the program period closes and James Miller, Jr. (CFO) becomes their primary contact for invoicing and ongoing concerns.

Add a closeout card in the homeowner hub that appears as Day 90 approaches and after closeout: what changes, what continues under the management agreement, and the new primary contact. Nothing in it promises a tax outcome.

## 4. Your ARHA contacts

The packet names the people. The portal names nobody. The card makes the working relationship explicit rather than implying Kati and Emily handle day-to-day traffic:

- **During onboarding** — the homeowner's day-to-day contacts are their project manager and utility manager, shown by name from the home's actual assignments. Kati Hand (Director of Onboarding) and Emily Jimenez (COO) are listed as the escalation contacts.
- **After handoff and listing** — the day-to-day contacts become their property coordinator and the Director of Onboarding for continued management of the home. Emily remains the escalation contact through the program period.
- **After Day-90 closeout** — James Miller, Jr. (CFO) becomes the primary contact for invoicing, billing and ongoing owner concerns.

Each person shows role, email and direct line; the packet's people are exact, the PM / utility manager / coordinator come from the home's assignments and fall back to the escalation contact when a seat is unfilled.


## 5. End-to-end test on a sample Active Owner home

Once the four pieces are in, I run the whole journey against a sample Active Owner property rather than spot-checking screens. For each of the six phases — Initial Onboarding, Design Alignment, Setup Progress, Owner Handoff, First Confirmed Booking, Day-90 Review — I confirm:

- the trigger that moves the home into that phase actually fires and the journey strip advances,
- a request of each type that belongs to that phase can be raised, reaches the homeowner's queue, and is labeled with the right category,
- the deadline shows in Central Time, goes overdue on time, and the overdue state is visible to both the homeowner and the supervisor,
- the notification reaches the assigned staff member and the homeowner check-in reminder fires in its milestone window,
- the decision the homeowner makes writes through to the task and cannot be overwritten.

I report the result phase by phase, naming anything that did not fire. Email delivery is still blocked until the ARHA mailbox reconnects, so mail steps are verified as far as the queued, correctly addressed message and flagged as unsent.

## What I am not changing

- The eight request categories, their wording, and the "what good completion looks like" behavior — already correct.
- Anything that would state a number of hours to a homeowner or imply a tax result. The packet is careful here and so is the portal.

## Technical notes

- New `src/lib/owner-journey.ts` (pure): the six packet milestones, plus a function deriving current stage from the existing program/onboarding/booking signals. Unit tested.
- New `src/lib/arha-contacts.ts`: the packet's contact records and a selector by program phase.
- New components `src/components/owner/JourneyStrip.tsx`, `AfterDayNinety.tsx`, `ArhaContacts.tsx`, rendered from `src/routes/_authenticated/owner.tsx`.
- Central Time formatting via the existing date helpers; overdue derived from the existing `dueOn` in `OnboardingActions.tsx` and the approvals projection. Presentation only — no schema change, no new server function.
