# design-review-director: the Director of Onboarding reviews the Designer's work (Nov 17)

Asked by Emily (Admin) in the same message that approved onboarding-team-cleanup: there is no Lead
Designer; the Director of Onboarding reviews the Designer's work, and a Designer never reviews their
own design work. Runs after onboarding-team-cleanup (migration 0353).

## What apply.sql does (one transaction, one audit row `design_review_director.apply`)
1. The step review setting and Task review whose reviewer was Lead Designer (moved to Designer by
   0353) now name the Director of Onboarding (`onboarding_director`, the code the review settings
   screen offers). The step review setting gets a history row, like a normal save.
2. Names: 9 fixed renames (Lead Designer becomes Director of Onboarding, Staging Team becomes Stager)
   on live template steps and on open, not archived Tasks and their linked work. Completed Tasks,
   archived Tasks and saved template versions keep their names. Status, dates and history unchanged.

## Preflight (read only, Nov 17, after 0353)
0353 applied 1; step review setting with Designer reviewer from Lead Designer 1; Task review 1; live
template steps naming Lead Designer or Staging Team 13; open, not archived Tasks 25; Director of
Onboarding role active.

## Practice (live data, rolled back, Nov 17)
After apply: step "Upload the floor plans" reviewer {onboarding_director}; Task review
{onboarding_director}; that review's reviewer resolves to the Director of Onboarding; no review names
Designer; steps left 0, open Tasks left 0, completed kept 10, archived open kept 24; counts 1 / 1 / 13
steps / 25 Tasks / 25 work items; work titles match their Tasks. Undo matched every fingerprint
(reviewers with updated_by/updated_at, Task reviews, steps with updated_at, Tasks with updated_at and
completed_at, work items with updated_at): `undo matches before: true`.

## Files and checksums (sha256)
819d9b0eaebd7c83f3b347c291ea1ef38cb4fbc1e02e7bdf803316ded7dbda46  apply.sql
f73a2d0d6d0a82fdfe21f5b6e51f3bf12141a0af9bc1c49addb2bd33596dcb15  apply.undo.sql
bacc514dbeed798a76390e94d7730e6c4ac0f3fb2efaf0dade36ff8560fa40da  preflight.sql
468d1ec93f1c753d217b5e9ee0a2ac8fea58797ed506aaec6f0cd2dee7526b89  practice.sql
