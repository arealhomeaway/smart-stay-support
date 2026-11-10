# Wording: role names in the Standard plan's task text (Build 7, item 4, register H1)

STAGED ONLY. NOT APPLIED. Apply in an evening window with Emily's okay.

## What it changes
- Plan: ARHA Onboarding - Standard (84f3a777-44a8-430a-af7e-8f18dc9a7dae), today on version 4.
- Rewrites the title and instructions of 9 working steps so they name roles, not people (37 name mentions; one email address, kade@arealhomeaway.com, is kept as a contact address).
- Publishes version 5 with exactly the snapshot the Publish action writes. Version 5 equals version 4 except the title/detail of those 9 steps (checked inside the file; it refuses otherwise).
- No other table, step setting, order, role, due rule, owner rule or handoff rule changes.

## Which homes it affects
- No existing home. Homes keep the version they started on:
  - 624 Daniel Court: Standard version 3 (its copied Tasks keep the old words, 4 of 8 such Tasks still open).
  - 8602 E. Galveston St., 3400 N Fern Ave: Full Plan version 1.
  - 1464 Buckland Ct, 3915 W 104th St S, 1399 Foxtail Ln, 9211 Fitzgerald Dr: V2 version 1.
  - 4 demo or older projects with no plan version.
- Only homes started on the Standard plan after this is applied get the new words.

## Word changes (each appears exactly once today)
- "Emily Jimenez, our COO" becomes "our COO"
- "Emily Jimenez, COO" becomes "the COO"
- "Optional: Steve and Mike from DFY." becomes "Optional: the DFY team."
- "with Emily, our COO" becomes "with our COO"
- "ask Emily to host the call" becomes "ask the COO to host the call"
- "On this call, Emily will walk you" becomes "On this call, our COO will walk you"
- "Confirm the time with Emily, who hosts the call." becomes "Confirm the time with the COO, who hosts the call."
- "Emily leads this call." becomes "The COO leads this call."
- "Emily, our COO, hosts it." becomes "Our COO hosts it."
- "Ask Emily to schedule and host" becomes "Ask the COO to schedule and host"
- "send them to Kade for CC&R review" becomes "send them for CC&R review"
- "Kade reviews the CC&Rs" becomes "The Compliance lead reviews the CC&Rs"
- "His review feeds" becomes "That review feeds"
- "ask for his review." becomes "ask for a review."
- "let Kade know" becomes "let the Compliance lead know"
- "Kade has been asked to review them" becomes "the Compliance lead has been asked to review them"
- "Kade hasn't finished 3 business days after you sent them: follow up with him directly." becomes "The Compliance lead hasn't finished 3 business days after you sent them: follow up directly."
- "This depends on Kade's CC&R review" becomes "This depends on the Compliance lead's CC&R review"
- "confirm Kade's review is complete" becomes "confirm the CC&R review is complete"
- "once Kade's review is done" becomes "once the CC&R review is done"
- "Kade's review is not done" becomes "The CC&R review is not done"
- "follow up with Kade." becomes "follow up with the Compliance lead."
- "Kade, could you set up sales tax" becomes "Could the Compliance lead set up sales tax"
- "Ask Kade to send the owner portal link" becomes "Ask the Compliance lead to send the owner portal link"
- "Mark this complete when he confirms." becomes "Mark this complete when they confirm."
- "Kade confirms the portal link was sent." becomes "The Compliance lead confirms the portal link was sent."
- "Owner portal, statements, and reporting: James Miller, Jr. (CFO). Booking and pricing: Micah Sinor (Operations Manager). Marketing: Emily Jimenez (COO). Distributions and billing: KD Keim. Property compliance: Kade Burleson." becomes "Owner portal, statements, and reporting: our Finance lead. Booking and pricing: our Director of Operations. Marketing: our COO. Distributions and billing: our Finance team. Property compliance: our Compliance lead."
- "We're happy to schedule a walkthrough with James, our CFO." becomes "We're happy to schedule a walkthrough with our Finance lead."

Steps changed:
- Send the introduction email and schedule the Owner readiness call
- Send the Owner readiness call invite
- Save the HOA documents and send them to Kade for CC&R review (title becomes: Save the HOA documents and send them for CC&R review)
- Hold the Owner readiness call
- Review STR requirements and send permit costs to the PM
- Confirm PriceLabs and sales tax setup
- Hold the launch preparation meeting
- Send the Managing Your Home email
- Request the owner portal link

## Role choices that need Emily's okay
- Kade (CC&R review, sales tax, owner portal link): written as "the Compliance lead". This is not one of the register roles; Emily may prefer another role.
- James (CFO) and KD (distributions and billing): written as "our Finance lead" and "our Finance team".
- Micah (booking and pricing): written as "our Director of Operations".
- Steve and Mike from DFY (partner, not ARHA): written as "the DFY team".
- kade@arealhomeaway.com stays as the address to email. Say if a shared address should replace it.

## Files
- 01_standard_plan_role_wording.sql: apply. Refuses unless the plan is still on version 4 with the same snapshot fingerprint and unchanged working steps; each step update also checks its exact old text.
- undo/01_undo_standard_plan_role_wording.sql: puts the 9 steps back from version 4 and removes version 5. Refuses if any home started on version 5 or a later version exists.
- SHA256SUMS: checksums of the two SQL files.

## Practice (Nov 9)
Run on an isolated copy of the live plan rows (same version 4 fingerprint) with the live step triggers: apply made version 5 with 144 steps, 0 names left, exactly 9 steps changed; a second apply refused; undo returned to version 4 with working steps equal to version 4; undo refused once a home had started on version 5. The live database was not written.
