# template-version-names: saved template versions use the new role names (Nov 18)

Approved by Emily (Admin), Nov 18, as a follow-up to onboarding-team-cleanup and design-review-director.
Applied live as migration `0356_template_version_names.sql` (same text as `apply.sql`).

## What apply.sql does (one transaction, one audit row `template_version_names.apply`)
In the 9 saved template versions, the 28 step names that still said Lead Designer or Staging Team
get the same fixed renames design-review-director gave the live steps (Lead Designer becomes Director
of Onboarding; Staging Team or staging team becomes Stager). Only the step name changes. The version
lock (`block_template_version_mutation`) is switched off for this change only and back on in the same
transaction. Tasks are not touched (completed, archived and open). Refuses to run if the count is not
28 in 9, if a name has no fixed rename, or if it is already applied.

## Preflight (read only, Nov 18, before apply)
design-review-director applied 1; saved version steps naming them 28 in 9 versions; names with no
fixed rename 0; live template steps naming them 0; version lock on.

## Practice (live data, rolled back, Nov 18)
names left in any version 0; step names changed 28 in 9 versions; every changed name follows the fixed
rename; everything except step names unchanged (other step fields, stages, version, published date and
publisher); version lock back on; live steps and Tasks unchanged; undo matched every fingerprint
(`undo matches before: true`).

## Live result (after apply)
Versions changed 9, step names changed 28, names left in any version 0, live steps left 0, version lock
on, completed Tasks with old names kept 10, archived kept 24, live step and Task fingerprints identical
to before.

## Files and checksums (sha256)
1362ab3045b2f0750f3b159d744141bb0ba4f9b0ee5e778a79b52fbb3bb87758  apply.sql
237c4d515da95808fd973e315bd6d0dd95988dda4c61b7e9a307c4ca5cacad5e  apply.undo.sql
fc25b18c5bba155dbfd166437a205ac0c8b00fecac762d6d3a5bff2c8a613d90  preflight.sql
eb6c8a0384c97b25a1a9cbb49fb2adf35aa1000450379e1a7aaff5e66fe18b87  practice.sql
