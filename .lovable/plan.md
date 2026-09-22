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

The packet names the people. The portal names nobody.

Add a contacts card showing the homeowner's onboarding contact (Kati Hand) and Active Owner contact (Emily Jimenez) during the program, switching to James Miller after closeout — with role, email and direct line, matching the packet exactly.

## What I am not changing

- The eight request categories, their wording, and the "what good completion looks like" behavior — already correct.
- Anything that would state a number of hours to a homeowner or imply a tax result. The packet is careful here and so is the portal.

## Technical notes

- New `src/lib/owner-journey.ts` (pure): the six packet milestones, plus a function deriving current stage from the existing program/onboarding/booking signals. Unit tested.
- New `src/lib/arha-contacts.ts`: the packet's contact records and a selector by program phase.
- New components `src/components/owner/JourneyStrip.tsx`, `AfterDayNinety.tsx`, `ArhaContacts.tsx`, rendered from `src/routes/_authenticated/owner.tsx`.
- Central Time formatting via the existing date helpers; overdue derived from the existing `dueOn` in `OnboardingActions.tsx` and the approvals projection. Presentation only — no schema change, no new server function.
