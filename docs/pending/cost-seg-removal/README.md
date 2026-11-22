# cost-seg-removal: remove "Coordinate the cost segregation study" from the onboarding plan (Nov 22)

Requested by Emily (Admin), Nov 22, item 3 of "Onboarding utilities and checklist cleanup".
Staged only. Apply only on "Approved: apply cost-seg-removal".

## What apply.sql does (one transaction, one audit row `cost_seg_removal.apply`)
1. Switches the step off in the live Standard plan template (ARHA Onboarding - Standard).
2. Saves plan version 9 = saved version 8 without this one step. New homes start from the newest
   saved version, so they no longer get it. The 4 other step edits that are in the live template but
   not yet in a saved version (Share the Make Ready Estimate, Share the mood boards and floor plans,
   Share the staging plan with the Active Owner, Share the final costs) stay unsaved, as today.
3. Archives the 8 open copies on in-progress homes (same fields as the existing Void action, reason
   "removed from the onboarding plan template"). Archived Tasks keep their history and are never counted.
4. The 1 completed copy (1464 Buckland Ct.) is not touched. Saved versions 1 to 8 are not touched.
Refuses to run if already applied, if the step or the newest version changed, or if the open count is not 8.

## Preflight (read only, Nov 22)
template step active 1; other active steps with this name 0; open tasks on in-progress homes 8;
completed tasks kept 1; open tasks with links (cards, owner items, Breezeway, notes, subtasks, dependents) 0;
already applied 0. Newest saved version is 8.

Homes with an open copy: 250 Springfield Xing, 2601 W 65th St S, 3361 E 153rd St S, 3400 N Fern Avenue,
624 Daniel Court, 6302 Meadow Path Way, 8602 E. Galveston St., 8738 Comstock Ct.

## Practice (live data, rolled back, Nov 22)
step active after apply false; version 9 has 142 steps, no cost segregation step, otherwise identical to
version 8; archived 8; open left 0; completed kept 1; notices 0, emails 0, project events 0;
undo: newest version 10 equals version 8; fingerprints of steps, tasks and versions 1 to 8 identical before and after.

## Undo (apply.undo.sql)
Switches the step back on, saves the next version as an exact copy of version 8 (saved versions are never
changed or deleted) and unarchives exactly the 8 Tasks this change archived.
