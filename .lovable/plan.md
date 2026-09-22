# Onboarding in the Homeowner Portal

Bring onboarding work that needs the homeowner into /owner: the items waiting on them, the mood boards and design files attached to those items, one-click Approve / Request changes, and a simple view of how the onboarding is progressing.

Most of the machinery already exists — onboarding staff can already send a task to the homeowner for approval, and the portal already has an approvals panel. What is missing is that onboarding items are not separated out, carry no attached files, and there is no progress view. This plan closes those gaps rather than building a second approval system.

## 1. Onboarding Actions section in /owner

A new "Onboarding actions" section at the top of the homeowner hub, above the general approvals panel, shown only when the homeowner has a home in onboarding.

Each card shows: the home, what is being asked (mood board approval, smart lock / Wi-Fi preference, staging sign-off), the staff-written explanation, when it is needed by, the attached files, and the two decision buttons.

Once decided, the card moves to a short "Recently decided" list with the decision and the note the homeowner left.

## 2. Mood boards and task attachments

Staff side already supports attaching files to an onboarding task and marking a file as shared with the homeowner — no new upload surface is needed. What changes:

- The task drawer gets a clear "Shared with the homeowner" marker on the files list so a PM can see at a glance what the owner will receive with the request.
- The homeowner's onboarding card lists each shared file with a thumbnail for images, size, and a download link, using the existing owner file-access checks (a file only appears when it is explicitly shared and the homeowner still has access to that home).

## 3. Approve / Request changes

The decision itself reuses the existing single-shot approval record, so it keeps every guarantee already in place: the homeowner only ever sees a summary a staff member has reviewed and published, a decision cannot be overwritten, and the answer is written to the task's own approval history.

- "Approve" records approval immediately.
- "Request changes" requires a short note (already enforced) and sets the task back to "changes requested".
- The onboarding task status updates from the same transaction, and the existing approval notification reaches the assigned project manager. The Ready Now queue and task drawer pick the change up on their next read.

One existing rule stays and is worth naming: a request the homeowner can act on must first be reviewed and published by staff. An unpublished item shows as "waiting on ARHA" with no buttons, rather than being hidden.

## 4. Onboarding progress

A compact progress block in /owner during onboarding: one meter per track — Access & Utilities, Furnishing & Staging, Media & Listing, Ops & Readiness — plus an overall percentage, for each home of theirs still in onboarding. Counts only; no task titles, assignees, blockers, vendor or cost detail.

## 5. Demo continuity

DEMO — Willow Creek Cottage gets a pending "Mood board review" onboarding action with a sample mood board image attached, plus published owner-facing wording so the card renders fully when viewing /owner as Riley Adler. The demo is walk-through only: demo approvals are deliberately non-decidable, so the buttons show a "demo — decisions are disabled here" state rather than writing anything.

## Technical notes

- Migration (additive, replaces one read function): `read_owner_approvals` currently flattens every request to `kind = 'other'`. Add `entity_type` and the real `kind` to the returned JSON so the portal can split onboarding items out. No column or policy changes; the Zod schema in `owner-approval.server.ts` gains the two optional fields.
- New server fn `ownerOnboardingActions` in a new `src/lib/owner-onboarding.functions.ts` / `.server.ts` pair: for the signed-in homeowner's enrolled properties, return onboarding-task approvals (from the existing projection), each with its shared attachments resolved through `ownerDocumentAccess`, plus per-track progress computed with `trackForTask` / `buildWorkstreams` from `onboarding-workstreams.ts`. Property scoping goes through `owner_property_access`; preview/demo goes through the existing `loadOwnerHomePreview` admin path so staff can walk it read-only.
- New components `src/components/owner/OnboardingActions.tsx` and `OnboardingProgress.tsx`, rendered from `src/routes/_authenticated/owner.tsx`. Decisions call the existing `decideOwnerApproval`; success invalidates `owner-approvals`, `owner-home` and the new `owner-onboarding` keys.
- Demo data: extend the demo seed function rather than inserting rows ad hoc, so a demo reset reproduces the mood board action and its sample file.
- Tests: unit tests for owner-safe projection (no staff-only fields leak), track progress counts, and attachment filtering; SQL test that the updated projection still hides unpublished detail.
