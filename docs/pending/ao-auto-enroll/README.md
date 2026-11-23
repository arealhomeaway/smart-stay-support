# ao-auto-enroll: Active Owner enrollment fully automatic on every path (Nov 23)

Requested by the Admin (Emily), Nov 23. Staged only. Apply only on "Approved: apply ao-auto-enroll".
The screen and server code is in preview; without this change every automatic enrollment stops at the
first step and is shown as "Active Owner setup will finish once the update is turned on."

## Why a database change is needed
The existing enrollment step refuses anyone who is not an Admin or the Director of Onboarding, needs an email,
and needs a closing date. The rule now is: whoever sets a home to Active Owner, it enrolls; missing details never block.

## What apply.sql does (one transaction, additive, one audit row `ao_auto_enroll.apply`)
1. `is_onboarding_director`: unchanged for every caller, plus true for exactly one person only inside the
   server-only automatic setup (a transaction-local flag that no app request can set).
2. `active_owner_enrollment_step`: unchanged for every current caller (manual Enroll window, Add property by
   Director/Admin). Only inside automatic setup: no email means no login and no welcome yet (the program still
   goes live and activities open); no closing date stops before the closing step.
3. New `active_owner_auto_enrollment_step(actor, ...)`: server-only (service role); refuses unless the actor is an
   enabled staff account (never owner or vendor); runs the existing step as that person, recorded as them.
4. New table `active_owner_setup_items`: Needs you now items (add the homeowner's email, add the closing date,
   needs attention). Written only by the server; staff read their own, Admin all, the Director the shared ones.

## Preflight (read only, Nov 23): 7 of 7 true
Function versions are the reviewed ones (md5 8842731f... and 0949edaf...); wrapper and table not there yet;
flag name unused; the 8 live Active Owner homes are enrolled with a login; no live home is labelled Active Owner
without a live program, so the first 5 minute check enrolls 0 homes.

## Practice (live database, rolled back, Nov 23, demo homes only)
Wrapper refuses a signed-in caller; a Project Manager calling the enrollment step directly is refused and is not
treated as the Director outside automatic setup; no-email demo home: program active, no login, 30 activities open,
no welcome, repeat run adds nothing; no-closing demo home: program and link made, stops before closing
("A closing date is required."); the normal Director path without a closing date or email is still refused;
staff notices 0, owner notices 0, emails 0; real homes unchanged. Verified afterwards nothing persisted.

## Known difference from the request (item 3c)
A home with no closing date is enrolled and linked (and gets its login when the email exists), but the program
cannot go live and cards cannot open until a date is saved: the existing activation requires a closing date,
and the Active Owner window is counted from closing. A Needs you now item asks for the date; once saved
(any screen), the save or the 5 minute check finishes setup. Changing this needs a decision on what date to use.

## Undo (apply.undo.sql)
Copies every setup item into one audit row, removes the wrapper and the table, and restores both functions
byte for byte from original_*.sql.
