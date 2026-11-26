# Owner-only duplicate archiving

Authorized by Emily's Nov 26 request to wire self-service duplicate removal by archiving the duplicate and keeping the original, continuing the Nov 25 authorization: “Approved: apply any database changes this needs.”

## Rule

- Only an active homeowner member can use the action. Staff, other owners and synthetic accounts outside the demo gate cannot.
- Entries match only when date, minutes and description match exactly.
- The earliest current matching entry is the original and cannot be archived through this action. Only a later copy can be archived.
- Archiving keeps the complete row, attachments, owner identity and prior history. It records the actor, time, reason and audit event. Nothing is deleted.
- Archived copies leave current history, hours totals, reports and badge inputs. They no longer trigger the ten-minute repeat guard. An archived edit no longer supersedes its original.
- No emails, alerts, schedules, card logic or automation change.

## Files and safety

- `preflight.sql`: read-only counts, real-entry fingerprint and reviewed function hashes.
- `apply.sql`: additive archive fields, one caller-authenticated archive action and active-entry reader filters. Applied as 0388.
- `finish.sql`: keeps the existing immutable-work guard and admits only the three archive metadata fields. Applied as 0389 after the live guard refused the first archive attempt; no entry changed in that failed attempt.
- `apply.undo.sql`: revokes future archive calls without deleting or unarchiving any work. The archive fields and active-entry filters remain so prior owner choices stay truthful.
- `qa/owner-history-duplicates-practice.ts`: isolated practice using captured live table definitions and canonical owner functions. Identity and notification helpers are modeled; this is not a full live-schema clone.

Live preflight on Nov 26: zero archive columns; 203 real entries; real-entry fingerprint `1df7ed5e54acc116b04faae6f73a7ea2`. Function hashes matched the values recorded in `preflight.sql`.
