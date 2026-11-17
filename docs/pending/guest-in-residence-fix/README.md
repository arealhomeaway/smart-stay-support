# guest-in-residence-fix (Nov 17)

Asked by Emily (Admin). Apply only on the exact words `Approved: apply` for this folder.

## Cause
`tickets.guest_in_residence` defaults to true, and the Notion import, Breezeway and email paths
never set it. With no stored active-stay answer, the guest rules (src/lib/guest-impact.ts) fall back
to that flag, so vacant homes are treated as an active stay: the "Tell the guest" step shows and
"Yes, responded" saves the next update in 2 hours (the preselected choice), which brings the step back
2 hours later. Nothing cleared the guest update clock when a ticket was resolved (#1467).

## What apply.sql does (one transaction, one audit row `guest_in_residence_fix.apply`)
1. Column default false.
2. Trigger `tickets_no_guest_clock_when_done` (BEFORE INSERT or UPDATE of status or the clock):
   resolved or closed tickets have no guest update clock.
3. Backfill with ticket triggers held (no history lines, alerts, reassignment or updated_at):
   vacant + no guest impact: guest_in_residence false and no guest update clock; resolved or closed:
   no guest update clock. Occupied tickets (#4930, #4941, #4960) are not touched. Every prior value
   is kept in the audit row for undo.
Touches no bonus function (private.bonus_facts fingerprint fa2ae6f229d9a17ba0e00cc407adb8d1 before
and after the practice).

## Preflight (read only, Nov 17)
Default true; vacant + none + guest in residence 2,978; of those with a guest clock 3; resolved or
closed with a clock 1 (#1467, also vacant); rows changed 2,978; occupied tickets #4930 #4941 #4960;
all ticket triggers enabled; bonus_facts fa2ae6f2...

## Practice (live data, rolled back, Nov 17)
Backfill changed exactly 2,978 rows (2,978 vacant with no guest impact; 0 more for finished tickets).
Left after: 0 / 0 / 0. #1465 #1467 #1511 guest false, no clock; #4930 #4941 #4960 unchanged.
Demo tickets on DEMO Birch Lane Retreat: vacant (no guest fields) false; occupied (app rule) true with
clock; imported (import column list) false; created resolved with a clock: clock removed; occupied
then resolved: clock removed, and setting it again stays removed. All ticket triggers enabled after.
Undo: default true, trigger gone, fingerprint of every ticket's flag, clock, updated_at and status
matches before: `undo matches before: true`.

## Files and checksums (sha256)
dbe720c160e8c8d4ebcb42f0a867c9cae8e229e27b4e0760c689180871a802ce  apply.sql
e224fe72662c8016efdb08dbcacd9c2f96ae118b21b4a71e6c41adc15b0c2750  apply.undo.sql
6175ddb17d46517e199d5033d96700cc43af5e3579452d51f961278d8f548eed  preflight.sql
8203e9194223336ade748fe4a9a7b52d21b61ce064a0086fa753fa32a73c9c3b  practice.sql
