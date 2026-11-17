# onboarding-team-cleanup: one Designer, one Stager per home (Nov 17)

Status: STAGED. Not applied. Apply only on the exact words `Approved: apply onboarding-team-cleanup`.

## What apply.sql does (one transaction, three audit rows)
1. Designer: moves `lead_designer` and `design_staging` to `designer` in role pools (merged, no
   duplicates), home teams (`onboarding_projects.role_assignments`; the `lead_designer` person wins a
   conflict), template steps, every template version snapshot (role fields only; the version lock
   is switched off and back on inside the transaction), onboarding Tasks, work items, step reviewer
   settings and Task reviews. Status, dates and history are untouched (update-time triggers are
   held for the role-only change). The three retired roles are switched off, not deleted.
2. Stager: one live stager per home (unique index plus a check in `set_onboarding_project_stagers`).
   No home's stager changes. `staging_provider` column and history stay.
3. Assem Please vendor (candidate, Indy, Staging and Make Ready, Notion 4174658d-...) created
   unless the Notion ID already exists, and set as Stager on 8738 Comstock Ct.
4. Role checks in `bulk_update_onboarding_home_tasks`, `bulk_update_onboarding_template_steps`,
   `plan_catch_up_tasks`, `private.review_role_person` patched from their live text; any mismatch
   stops everything. Bodies before and after: functions-before.sql, functions-after.sql.

Not touched: file category `design_staging` ("Staging instructions"), any permission.

## Preflight (read only, run Nov 17)
Old Designer pool rows 2 (one person); Staging Team pool 0; homes on old keys 5; conflicting
designers 0; live template steps 8; Staging Team template steps 0; version snapshot steps 25;
Tasks 39; Staging Team Tasks 0; work items 39; step reviewer settings 1; Task reviews 1; Assem
Notion ID 0; Comstock stagers 0; homes with more than one stager 0.

## Practice (live data, rolled back, Nov 17)
After apply: nothing left on old codes; Designer pool 1; 120 Designer Tasks (43 complete);
Comstock stager Assem Please / Damon Jones / candidate / Indy / Staging, Make Ready; three audit
rows. As Kati on DEMO Birch Lane: pick Designer then Designer Task routes to her (pass); assign to
Lead Designer refused; two stagers refused. Undo restored every fingerprint exactly (pool, roles,
teams, steps, versions, Tasks with updated/completed/due dates, work items, reviewers, stagers,
vendors, functions): `undo matches before: true`.

## Files and checksums (sha256)
4afaa20cf6d1ea8b4e387775ad7f40d341f52f402e40fe9c3de52b4e857d1beb  apply.sql
51bf2fa9017553ff53c5487be76d9852c1c3e1ecdc2cd30f7483e889f293611c  apply.undo.sql
5ed92031180006ee9d664976954ebdc4ad5f83d1e60c59f360f8e6968491403d  preflight.sql
6266184fc1d1de6efeec7692c1beab281d2b7fa4fde9243546cffb9cbf2353c9  practice.sql
68518eee6dca933fdf91860bb42da908f3655b2897767cf18231dc444422ef42  functions-before.sql
8f309f5b1a6bc92822562ddf0dbe35aee7b5ee84819e007138af106657855f8e  functions-after.sql
