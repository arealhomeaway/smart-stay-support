# ao-module-sync: Active Owner setting matched to enrollment (Nov 23)

Requested by the Admin (Emily), Nov 23, item 4. Staged only. Apply only on "Approved: apply ao-module-sync".

## What apply.sql does (one transaction, one audit row `ao_module_sync.apply`)
Turns the Active Owner module on for exactly two onboarding projects, 3400 N Fern Avenue and 624 Daniel Court,
which are enrolled with live programs and have Owner Type Active Owner but the module off. One History line per
home: "Active Owner setting matched to the home's enrollment". Runs as the approving Admin because project
changes need a signed-in onboarding account (existing database rule). No program, card, login, notice or email
is touched. Refuses if already applied or if either home no longer matches.

## Preflight (read only, Nov 23): 5 of 5 true
Not applied yet; both homes have the label, module off, and a live program with a login; each has exactly one
project; no other live home has the label without the module.

## Practice (live data, rolled back, Nov 23)
module on for both = true; history lines 2; audit rows 1; projects changed 2; all project events 2;
programs unchanged; cards unchanged; staff notices 0; owner notices 0; emails 0. Verified afterwards nothing persisted.

## Undo (apply.undo.sql)
Removes only the module this change added on these two projects, with a History line; History and audit kept.
