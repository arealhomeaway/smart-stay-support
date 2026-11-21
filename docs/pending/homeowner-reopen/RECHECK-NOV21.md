# Recheck against today's database (Nov 21)

Files unchanged since Nov 18 (CHECKSUMS.sha256 all OK).

Preflight today: homeowner_updates absent, the three actions absent, ao_edit_card_answer md5
2b3672794e95c6f7a60b91a6bffa3926 (as expected). One difference: Shannon Linder's program has 65 entries,
all hers and current (the preflight note said 36). That is the Nov 18 repeats; shannon-hours-links fixes it.

Practice today (live database, rolled back), unchanged practice.sql:
1 edit submitted: 60 min, 2026-11-10, submitted, amends original t; 2 edit reviewed: 75 min, submitted,
reviewed no; 3 add more: files 1, note kept t, submitted; 4 totals: reviewed 0 min, waiting 75 min,
current 1; 5 history: 4 entries, original unchanged t; 6 old version refused: This entry was already
updated. Refresh to see the latest version.; 7 outside file refused; 8 empty add refused; 9 another
homeowner refused: That entry is not available to you.; 10 empty card refused; 11 card with no answer:
answers 1, history 2; 12 finished Opportunity: now open, new messages 2, reopened 1; 13 owner items:
answered recorded 1, waiting recorded 0; 14 team lines 7, with chat line 7, new chat lines 7; 15 and 16
change and delete refused; 17 Admin reads 7, demo owner reads 7, another homeowner reads 0; 18 Shannon:
65 entries, 65 hers and current.

The demo owner's one entry went 45 -> 60 -> 75 minutes through two edits and an Add more: the total moved
by the difference only, with 1 current entry out of 4 saved.
(The practice run trimmed one comment line in the hours action; apply.sql is used unchanged.)
