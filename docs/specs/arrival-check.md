# Arrival check queue and Arrival readiness database (register BN4, BN10)

Approved by Emily on Nov 10, 2026. Purpose: the Property Coordinator bonus goal "homes ready for
guests" (every arriving home is checked at least 2 hours before check in, or the problem is flagged
with a safe backup plan) and a second line of verification so nothing slips. It is a bonus metric,
not a write up standard.

Switch `arrival_checks`, OFF. When Emily turns it on it sets a forward only start line and only
arrivals at least 2 hours after that moment get a check (same pattern as email intake, register E1).

1. WHICH ARRIVALS: every reservation in the OwnerRez sync that starts (check in date) at an active,
   verified Resolve home: new guest and tenant arrivals AND owner stays (if an owner is staying it
   must be perfect). NOT: extensions (a booking that starts the day the same guest's previous booking
   at the same home ends, or that OwnerRez links as a continuation), cancelled reservations, blocks
   (maintenance or hold blocks that are not an owner stay), homes that are not verified Resolve
   homes, New House homes.
2. WHEN THE CHECK IS CREATED: at 6:00 AM Central on the arrival date, one per arrival, once only (a
   unique record per reservation). The deadline is the reservation's check in time (the home's
   default check in time if the reservation has none, 4 PM) minus 2 hours, worked out in the home's
   own time zone and shown in Central time. A reservation made less than 2 hours before check in is
   created at once, marked Late booking, and does NOT count in the goal's total.
3. WHERE IT LANDS: an unowned ordinary ticket of its own kind, Arrival check, group From OwnerRez in
   the Team Queue, in Team B's queue unless a rule already ties a home to a team (Team B otherwise);
   anyone on a team can take it with Take it; it shows in Needs you now for the person who owns it;
   it is a normal ticket with normal clocks, shown with its due time and red inside the last 30
   minutes. It never appears in the Team Queue before 6 AM.
4. THE CHECKLIST on the ticket (all required before Complete check turns on): (a) Lock is connected
   (Yes or No; if No, a note; show the home's smart lock brand from the property page as a reminder,
   never a code); (b) Breezeway work orders reviewed (show the home's open Breezeway work orders from
   the mirror with their links, or No open work orders; the coordinator ticks Reviewed); (c) Ready for
   the guest, or Issue found (if Issue found: What is wrong and the Backup plan are both required).
   Also show the arrival date and time, the guest's first name only, guests and pets from the
   reservation, and a link to the property page.
5. WHEN AN ISSUE IS FOUND: on Complete check Resolve opens ONE normal ticket for the problem (Right
   now if the arrival is within 2 hours, otherwise Today), owned by the person who found it, with the
   backup plan attached and linked to the check; the check itself counts as passed because the issue
   was flagged with a backup plan.
6. RESULT, per check: On time (completed with every part by the deadline, including a flagged issue
   with a backup plan), Late (completed after the deadline), Missed (not completed by the check in
   time). A Late or Missed check is NOT a pass for the bonus and carries no write up or other
   consequence. The goal score is on time passes divided by eligible arrivals, never counting Late
   booking arrivals. Credit goes to the person who completed it; an arrival nobody took counts against
   the Operations Supervisor's team on time follow through goal. Every check, its result and who, is
   recorded in the scorecard capture tables as an add only fact (kind arrival_check). Only the score
   inputs are stored; the bonus bars and dollars are a separate build.
7. ALERTS: one alert to the Operations Supervisor, in app and by email, 30 minutes before the deadline
   for any check not complete ("Arrival check due at [time] at [home], not done yet"); nothing else;
   no alert for completed checks.
8. THE DATABASE: an Arrival readiness card in Databases (group Operations & Finance) with a list:
   columns Home, Check in, Deadline, Completed by, Completed at, Result, Issue and backup plan,
   Ticket; filters Period (This week, This month, This year, a chosen month and year, a custom range,
   applied to the arrival date), Home, Coordinator, Result, Team; a totals line (arrivals, on time,
   late, missed, percent on time); a search; an Open button to the check. Access: the Operations
   Supervisor, the Director of Operations, the COO and Admin see every row; a coordinator sees only
   their own rows; Finance views; onboarding roles hidden. View only in the list; work happens on the
   ticket.
9. SWITCH, START LINE AND TEST: switch `arrival_checks` OFF; Turn on moves the start line forward only
   and records who and when; nothing is created for older arrivals; a test reservation (at the
   Fitzgerald test home, marked with the existing test marking) creates a test check excluded from
   every count, score and report, visible to the Admin, the Supervisor and the Directors, with Clear
   test records covering it. The Integrations page shows the true state (off or on, the start line,
   the last run, checks created today, skipped with the reason).
10. TESTS and a real database step cancelled at the end (nothing kept), covering every rule above,
   plus a word check and a browser check on desktop and phone.

Protect what exists: the OwnerRez booking sync, the Team Queue, tickets, routing, clocks, alerts, the
scorecard capture and Databases keep working; no live OwnerRez searches beyond the existing sync.

## As built

See docs/pending/arrival-check/README.md (filled in at build time).
