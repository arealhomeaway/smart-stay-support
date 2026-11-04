# Phase 1: Operations fixes for PC testing

None of the three items needs a database change. All three are screen and behavior changes that use the same saving steps the app already uses today.

## 1. Routine Work: choosing a task opens its completion drawer

**Today:** In "Run a routine control", picking a check and pressing "Start it" saves a new check as due right now. The window closes, the check lands in "Due today", and nothing opens.

**After:**
- Picking the check (and the home and guest, if needed) and pressing "Open it" goes straight to that check's completion drawer, already filled in.
- Nothing is saved yet, so the check does not show up in "Due today".
- The check is only saved when the person finishes it in the drawer. It is saved as completed in one step and shows up under "Recently completed".
- If they close the drawer without finishing, nothing is saved and nothing is left behind.
- Before the check is saved, the drawer hides "Mark in progress" and the follow-up ticket button. The follow-up button shows up once the check is complete, as it does today.

**Files:**
- `src/routes/_authenticated/routines.tsx`: the chooser hands an unsaved check to the drawer instead of saving it.
- `src/components/routines/RoutineDrawer.tsx`: when the check has not been saved yet, "Complete" saves it as completed. Saved checks keep working exactly as they do now.

## 2. Record Work: one entry point in the top bar

- **Top bar:** the "Record work" button shows on every staff page, including the My Work and Ticket pages where it is hidden today. The rules for who sees it stay the same: staff who can log work, never vendor or homeowner views, never read-only previews. It still keeps the page and home you came from.
- **Removed duplicates:**
  - "Record work" in the left menu (`src/components/AppShell.tsx`)
  - "Report an issue" on Home (`src/routes/_authenticated/dashboard.tsx`)
  - "Report an issue" inside My Work (`src/routes/_authenticated/tickets.index.tsx`)
  - The guided tour step that points at the old left menu item moves to the top-bar button (`src/components/OnboardingTour.tsx`)
- **Kept separate:** Report a Claim, the lead drawer's issue button, the home history "Record work" button tied to that home, and the routine drawer's follow-up button.

Assumption: on Onboarding and Active Owner pages, the button stays off as it is today, because recording property issues is an Operations task. Tell me if you want it there too.

## 3. Dashboard: remove "The ARHA Way" card

- Remove the quote card next to "Recent activity" in `src/routes/_authenticated/dashboard.tsx`.
- "Recent activity" then spans the full width, so no empty space is left. The welcome banner stays the same.

## Checks
- Tests: choosing a routine saves nothing; finishing it saves one completed check; closing the drawer saves nothing; "Record work" shows on My Work and Ticket pages and only in the top bar.
- Run the full test suite, type check and build.
- Screenshots of Home, My Work and Routine Work in the preview.
- No publishing, no emails, and no changes to data, integrations or settings.
