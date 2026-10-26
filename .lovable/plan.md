# Help Tickets #57 and #56 — findings and proposed fix (nothing applied)

## 1. Why "Hold the Owner Investment Readiness Call" can't be edited

Kati's report (Ticket #57, Oct 26 03:50 UTC, /onboarding/templates, plan "ARHA Onboarding - Standard"): she can edit some steps but not this one.

No rule locks the step on purpose. No role rule, published-version rule, system key, gate or automation refers to it. Nothing in the code mentions it by name. Kati's Onboarding Director access allows edits. The step is active and required, blocks handoff, belongs to Intake, has the "feedback" homeowner need, and has a homeowner Opportunity.

The cause is a display bug in the Plan settings step window (`src/components/onboarding/TemplateV2Settings.tsx`):
- Line 117 loads the step's saved Opportunity wording as-is.
- Line 232 then reads the "Helpful links" list from that wording.
- On this step the saved wording has only title, what, why and how. The Helpful links list is missing, so that line crashes and the edit window fails to open.
- Steps with no Opportunity, or with a complete one, open fine. That's why some steps work and others don't.

What Kati sees: clicking the step either does nothing, or shows "The templates page could not be loaded." **Not verified** — her screenshot wasn't opened and the click wasn't replayed.

## 2. Every step locked the same way

All 23 steps on "ARHA Onboarding - Standard" that have an Opportunity are missing the Helpful links list (also "Ways to document" and "Suggested minutes"). The whole step window fails for each one, so every field is out of reach: title, description, instructions, due date and day type, role, module, conditions, required, blocks handoff, active, homeowner need, Breezeway and Opportunity wording.

The 23 steps, by stage:
- **Intake:** Hold the Owner Investment Readiness Call
- **Pre-Close:**
  - Work order: Walkthrough Video & Photos
  - Review STR requirements and send permit costs to the PM
  - Save the inspection report and ask the owner about repairs
  - Share the Make Ready Estimate with the owner
  - Share the mood boards and floor plans with the owner
- **Ordering & Repairs:**
  - Send the Property Management Agreement through DocuSign
  - Send the closing congratulations and onboarding timeline
  - Collect the closing documents
  - Share the first onboarding invoice with the Active Owner
  - Review the Pre-Work Inspection results
  - Send the weekly progress update
- **Setup & Staging:**
  - Share the staging plan with the Active Owner
  - Approve the completed repairs
  - Share the second onboarding invoice reminder with the Active Owner
  - Share the staged home with the Active Owner
  - Coordinate the cost segregation study
- **Preparing for Handoff:**
  - Upload the photos and listing content in OwnerRez
  - Review the Final Inspection results
  - Share the final costs with the owner
  - Share the guest instructions with the Active Owner
  - Hold the launch preparation meeting
- **Handoff:** Hold the handoff meeting

Other plans are not affected. "ARHA Onboarding V2" has 6 Opportunities and all are complete. The other plans have none.

Two other places can still edit these steps: the pencil button in the lower step list (it has no Opportunity fields), and the Delete button. **Not verified** in a live session.

One deliberate database rule also exists. The `owner_work_never_blocks_handoff` trigger quietly turns "Blocks handoff" off for any step that needs homeowner approval or is tagged Active Owner. That affects 2 steps on Standard, 2 on Full Plan and 3 on Full Furnishing. It doesn't stop the edit; the switch just doesn't stay on.

## 3. Which locks are necessary

- **The window crash:** not necessary. It's a bug.
- **The handoff rule (trigger):** necessary. It enforces the approved rule that homeowner work never blocks handoff. The problem is that it fails silently and gives no explanation.

## 4. Smallest fix (proposed, not applied)

1. In `TemplateV2Settings.tsx`, fill in any missing Opportunity parts with empty defaults when the window opens. Missing Helpful links becomes an empty list, missing Ways to document becomes blank, and missing Suggested minutes becomes none. That's a frontend-only change. When she saves, the step is stored complete, the same way the server check already fills them in. Add one regression test: a step whose saved Opportunity has only title/what/why/how opens and saves.
2. In the same window, when the step needs homeowner approval or is tagged Active Owner, disable "Blocks handoff". Add the note: "Homeowner and Active Owner work never blocks handoff. You can still change everything else on this step."
3. No database change and no data change. The 23 steps are fixed one by one as they're saved. An optional cleanup script to fill in the missing parts could be prepared separately for approval.

## 5. Ticket #56 (bulk edit) — read-only findings

**Same editor? No.**
- The template page has two editors for the same template step rows: the Plan settings window (`TemplateV2Settings`) and the pencil editor (`TemplateEditor`).
- A home's live plan Tasks use a separate editor in `TaskDrawer` and write to a different table (`onboarding_tasks`).
- Template changes reach only homes started after the next "Publish new version". Existing homes keep their version.

**Safe to bulk-change on template steps:**
- Due date offset (days)
- Calendar vs business days
- Schedule anchor (Access, Closing, Planned closing, etc.)
- Role
- Required
- Active in this plan
- Stage. The existing drag-arrange save already handles moves; if a move changes the order, the plan needs re-numbering.
- Module and conditions (from the allowed list only)

**Should not be bulk-changed:**
- Title, instructions, description, done-when and Opportunity wording. Each one is unique, and Opportunities must name specific items.
- Breezeway template ID (specific to each step).
- Blocks handoff on homeowner-approval or Active Owner steps (the database forces it off). Elsewhere, bulk "blocks handoff" is fine but should be shown before saving.
- Homeowner need. Only Business Decision blocks a Task, so a bulk change could alter what gates work. Leave it one at a time.
- Delete.

Bulk edits to live home Tasks are not assessed here. They touch work already in progress and would need their own rules.

## Not verified
- What Kati sees on screen (screenshot not opened, click not replayed).
- Whether the pencil editor works for the 23 steps in a live session.
- Whether the full page or only the window fails.
