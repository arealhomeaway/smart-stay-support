# Notion ticket import: dry run Nov 9 2026 (read only, register N6)

Run 05:37:43 to 05:39:26 UTC (1 min 43 s of Notion time, 40 min allowed). 222 Notion requests, every one answered first time (no rate limits).
Nothing was written to Resolve or Notion. The run used the app's own import rules (src/lib/notion-import/mapping.ts) and read-only Notion reader. Not to be run again.

## Step 1. Connection: yes (first ticket read: "Investigate Pet Fees").

## Step 2. Field-only pass, 30 batches of up to 100, finished: 2,916 tickets read, 0 remaining

Groups: Closed 2,225 (Done 2,223, Completed Same Day 2); Open, past 30 days 87; Open, older 604. Blank created date 86 (54 closed, 32 held as older; never recent).
Notion status: Done 2,223; In progress 298; Claim review 393; Completed Same Day 2.
Priority: Urgent 251, High 545, Medium 1,493, Low 434, blank 193. Mapped: P1 251, P2 545, P3 2,120.
Team group (open, past 30 days only; the others are never in the Team Queue): Team B 78, Team A 3, Unassigned 6.
Assignee: matched to an active staff member with a login 2,230; unmatched 31 (Nelson Mahilom 26, Avy Vergara 5); Director of Operations 627; General 9; blank 19. Only open tickets from the past 30 days get a person (65 do).
Claims: 680 (closed 81, open 599).
No matching home: 162 (146 with no home linked in Notion, 16 linked to 21036 Owens Rd). 133 closed, 24 open older, 5 open in the past 30 days. Every other linked home matched.
Linked to two homes: 6. Rule now (Emily, Nov 9): the home whose address appears in the title; if none does, the first linked home. Recheck below.

## Step 3. Preview of 20 (comments and files read for these 20 only: 103 comments, 45 files)

| # | Covers | Notion title | Status | Created | Group | Assignee in Notion | Matched | Team | Priority | Claim | Home | Comments / files | What Resolve shows |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Closed | 18205 -Fireplace Assistance | Done | 2026-02-01 | Closed | Mike Cacatian | Not assigned (not recent) | - | Medium -> P3 | - | 18205 Allora Dr | 3 / 0 | Not in Team Queue or Home. Badge: Historical record from Notion. No assignee. |
| 2 | Recent open, assigned | 3029 - Kitchen Sink Leak Under Disposal | In progress | 2026-10-29 | Open, past 30 days | Qym Fuenteblanca | Qym Fuenteblanca | Team B | Urgent -> P1 | - | 3029 NW 181st | 11 / 3 | Team Queue, Imported from Notion, Team B. Quiet: no clocks or alerts. Counts in the home's open tickets. |
| 3 | Recent open, unassigned | Urgent: Airbnb Listing Unlisted – 6847 Cardiff Dr (Camera Privacy Viol | In progress | 2026-10-21 | Open, past 30 days | General | Unassigned (General) | Unassigned | Urgent -> P1 | - | 6847 Cardiff Dr | 2 / 1 | Team Queue, Imported from Notion, Unassigned. Quiet: no clocks or alerts. Counts in the home's open tickets. |
| 4 | Director of Operations | Aircover - Ryan Sloan at 904 NE 34th - carpet stains | Claim review | 2026-10-15 | Open, past 30 days | Micah Sinor | Unassigned (Director of Operations) | Team B | Medium -> P3 | Claim review | 904 NE 34th Ter | 3 / 1 | Team Queue, Imported from Notion, Team B. Quiet: no clocks or alerts. Counts in the home's open tickets. |
| 5 | Claim, closed | Direct Booking  1152 -Casey Bates -  Missing Queen flat sheet | Done | 2025-07-12 | Closed | Mike Cacatian | Not assigned (not recent) | - | Medium -> P3 | Potential claim | 1152 Western Yarrow Ave | 4 / 2 | Not in Team Queue or Home. Badge: Historical record from Notion. No assignee. |
| 6 | Claim, open (claim review) | Aircover - Robert Van Kalsbeek at 3712 N 39th St. - From long term gue | Claim review | 2026-01-14 | Open, older | Micah Sinor | Unassigned (Director of Operations) | - | Medium -> P3 | Claim review | 3712 N 39th St. | 24 / 16 | Not in Team Queue or Home. Badge: Older open ticket from Notion. |
| 7 | Claim, open (recent) | VRBO - Holly Papa at 1016 NW 191st St - marijuana and cigarette | In progress | 2026-10-18 | Open, past 30 days | Mike Cacatian | Mike Cacatian | Team B | Medium -> P3 | Gathering evidence | 1016 NW 191st St | 2 / 0 | Team Queue, Imported from Notion, Team B. Quiet: no clocks or alerts. Counts in the home's open tickets. |
| 8 | No home: 21036 Owens Rd | 21036 - Garbage Disposal | Done | 2025-10-06 | Closed | Mike Cacatian | Not assigned (not recent) | - | Low -> P3 | - | Needs a home (21036 Owens Rd) | 3 / 0 | Not in Team Queue or Home. Badge: Historical record from Notion. No assignee. |
| 9 | No home linked | 207 - sink in master is draining slow ( sink nearest closet )and the h | Done | 2026-03-21 | Closed | Mike Cacatian | Not assigned (not recent) | - | Medium -> P3 | - | Needs a home | 2 / 0 | Not in Team Queue or Home. Badge: Historical record from Notion. No assignee. |
| 10 | Blank created date | 1068 - Blind Broken | Done | blank | Closed | Mike Cacatian | Not assigned (not recent) | - | blank -> P3 | - | Needs a home | 2 / 0 | Not in Team Queue or Home. Badge: Historical record from Notion. No assignee. |
| 11 | Open, older | 5047 - hot water is out again | In progress | 2026-08-08 | Open, older | Romeo Canales | Not assigned (not recent) | - | Urgent -> P1 | - | 5047 Skipping Stone Dr | 6 / 0 | Not in Team Queue or Home. Badge: Older open ticket from Notion. |
| 12 | Completed Same Day | 7071 Urgent – Garage Door Not Opening | Completed Same Day | blank | Closed | blank | Unassigned (blank) | - | Urgent -> P1 | - | 7071 Richardson Ct | 2 / 1 | Not in Team Queue or Home. Badge: Historical record from Notion. No assignee. |
| 13 | General assignee | 19104 - Trash Can Issue | In progress | 2025-11-29 | Open, older | General | Unassigned (General) | - | Medium -> P3 | - | 19104 Meadows Crossing Dr. | 4 / 1 | Not in Team Queue or Home. Badge: Older open ticket from Notion. |
| 14 | Assignee with no login | 2817 - Touch-up paint | Done | 2026-09-04 | Closed | Nelson Mahilom | Unassigned (no login) | - | Low -> P3 | - | 2817 Hazel Hollow | 2 / 0 | Not in Team Queue or Home. Badge: Historical record from Notion. No assignee. |
| 15 | Urgent priority | 2332 - suspected leak | In progress | 2026-10-22 | Open, past 30 days | Romeo Canales | Romeo Canales | Team B | Urgent -> P1 | - | 2332 Los Angeles Ave | 8 / 2 | Team Queue, Imported from Notion, Team B. Quiet: no clocks or alerts. Counts in the home's open tickets. |
| 16 | High priority | 1701 - leak in the skylight | In progress | 2026-10-22 | Open, past 30 days | Romeo Canales | Romeo Canales | Team B | High -> P2 | - | 1701 Park Lane Dr. | 6 / 2 | Team Queue, Imported from Notion, Team B. Quiet: no clocks or alerts. Counts in the home's open tickets. |
| 17 | Low priority | 4308 - guest bathroom toilet seat broken | Done | 2026-03-29 | Closed | Romeo Canales | Not assigned (not recent) | - | Low -> P3 | - | 4308 NW 158th St. | 10 / 3 | Not in Team Queue or Home. Badge: Historical record from Notion. No assignee. |
| 18 | Two homes linked | VRBO - Jeffrey Maichel at 2012 W Black Powder Way - Stained linens and | Claim review | 2025-11-11 | Open, older | Micah Sinor | Unassigned (Director of Operations) | - | Medium -> P3 | Claim review | 2012 W. Black Powder Way (was 18000 Barracho Dr.) | 8 / 13 | Not in Team Queue or Home. Badge: Older open ticket from Notion. |
| 19 | Blank title | Imported Notion ticket | In progress | blank | Open, older | blank | Unassigned (blank) | - | blank -> P3 | - | Needs a home | 0 / 0 | Not in Team Queue or Home. Badge: Older open ticket from Notion. |
| 20 | Recently edited | 3405 - Water Heater not Working | Done | 2026-03-02 | Closed | Mike Cacatian | Not assigned (not recent) | - | Medium -> P3 | - | 3405 NW 159th Ter | 1 / 0 | Not in Team Queue or Home. Badge: Historical record from Notion. No assignee. |

## No matching home (162)
- Investigate Pet Fees | No home linked in Notion | Done
- Templete review/addition | No home linked in Notion | Done
- 5020 - Airbnb Background Check | No home linked in Notion | Done
- 309 - Patio Light, Lamp, Storm damaged | No home linked in Notion | Done
- 1601 - Back Door Damaged | No home linked in Notion | Done
- Aircover  Jianbin Chen - 1601 Damaged Back Door | No home linked in Notion | Done
- 1601 - AC not responding | No home linked in Notion | Done
- Future Bookings Airbnb | No home linked in Notion | Done
- 1601 - Extension Request | No home linked in Notion | Done
- 19120 Water Line Disconnection Notice | No home linked in Notion | Done
- Reviewing Maintenance Work Orders (weekends) | No home linked in Notion | Done
- Reviewing Maint Work. See link | No home linked in Notion | Done
- 1601 - measure sinks / possible smoking / door issue | No home linked in Notion | Done
- Resolution - 21036 - Sarah Newman - Broken Mirror | 21036 Owens Rd | Done
- 21036 Lawn Schedule | 21036 Owens Rd | Done
- 21036 - Cleaning the Storm Shelter - Water Spiket not working outside / exterior outlets n | 21036 Owens Rd | Done
- Updating Trash Info | No home linked in Notion | Done
- LAWN CARE QUESTION | No home linked in Notion | Done
- Discuss reviewing/approving WO for Lotis | No home linked in Notion | Done
- 1601 - new sink replacement / new vacuum | No home linked in Notion | Done
- Aircover - 1601 - Ricki Rebeiro - House is a mess | No home linked in Notion | Claim review
- 1601 - Fence Repair | No home linked in Notion | Done
- 21036 - Pest Control Needed | 21036 Owens Rd | Done
- Aircover - 21036  - DJ Hosford - Damaged Linens, paint stains on floor, dog waste | 21036 Owens Rd | Claim review
- Owens - few maint items | 21036 Owens Rd | Done
- 4816 - Question about the bed | No home linked in Notion | Done
- Update OR blocks | No home linked in Notion | Done
- Wasp Nests Issues | No home linked in Notion | Done
- Updating the property description for listings that have pool | No home linked in Notion | Done
- 1601 - Kitchen Light | No home linked in Notion | Done
- 21036 Owens - electrical issue | 21036 Owens Rd | Done
- Larry Robinson Question | No home linked in Notion | Done
- 904 - AC not cooling | No home linked in Notion | Done
- Airbnb Quick Replies | No home linked in Notion | Done
- 1601 - Maintenance Issue and Lawn | No home linked in Notion | Done
- Changing Casey’s personal email to Info email for VRBO | No home linked in Notion | Done
- Disputing 1 Stars and 3 Star Rating | No home linked in Notion | Done
- Remember to “close” any of Larry’s “overdue” WO in BW that have comments | No home linked in Notion | Done
- On Call - Escalation / Over provide information | No home linked in Notion | Done
- Larry Robinson - Lawn Care Schedule | No home linked in Notion | Done
- Discuss lawn care owner emails | No home linked in Notion | Done
- Call Amerincan Pros for Returned Check Payment Notification | No home linked in Notion | Done
- 3200 - Follow UP with BC’s Booking | No home linked in Notion | Done
- LEAVE notes in OR (James m email) | No home linked in Notion | Done
- Responding to Poor reviews on Airbnb | No home linked in Notion | Done
- Booking question for Jim Foster 10549 | No home linked in Notion | Done
- Pool Amenity in Airbnb - | No home linked in Notion | Done
- Review booking for Amy - 453 (discuss current booking policy) | No home linked in Notion | Done
- 1215 - cooking pot replacement question | No home linked in Notion | Done
- Utility Review Update | No home linked in Notion | Done
- 19104 - offer to refund $200 | No home linked in Notion | Done
- 9120 Yassir - work on sending quote | No home linked in Notion | Done
- question on pet fee | No home linked in Notion | Done
- Aracely left a 4-star review - 721 Vaquero | No home linked in Notion | Done
- question on Daniel’s additional lawn care (irrigation) | No home linked in Notion | Done
- 19013 - potential water leak | No home linked in Notion | Done
- Updates Discussion | No home linked in Notion | In progress
- 1601 - Front and Back Doors Sticking Out | No home linked in Notion | Done
- CITY INSPECTIONS | No home linked in Notion | Done
- Louella Ryan at 13117 NE 9th St - Pet fee | No home linked in Notion | Done
- Kathy Lamont - vrbo id | No home linked in Notion | Done
- 28th Cleaning Work Order | No home linked in Notion | Done
- 4 star reviews | No home linked in Notion | Done
- Aircover - Monee Hollins at 21036 Owens Rd - Area Rug Replacement | 21036 Owens Rd | Claim review
- 15905 - Thermostats - Not keeping set temp | No home linked in Notion | Done
- 1169 - Master Toilet Flush needs repair | No home linked in Notion | Done
- 21036 - Garbage Disposal | 21036 Owens Rd | Done
- 1601 - Back door lock issue | No home linked in Notion | Done
- change codes - 13317 | No home linked in Notion | Done
- Question on claim | No home linked in Notion | Done
- 21036 - Guest Room Shower - No hot water | 21036 Owens Rd | Done
- Yale Low Batteries | No home linked in Notion | Done
- Sprinklers Status | No home linked in Notion | Done
- 21036 - no water | 21036 Owens Rd | Done
- 735 S - Change the lease agreement back | No home linked in Notion | Done
- Cleaning fee refund for Tara Heath - 10302 S. 230th East Ave | No home linked in Notion | Done
- 2012 - Haul the trash | No home linked in Notion | Done
- Imported Notion ticket | No home linked in Notion | In progress
- 21036 - Wasp in the house | 21036 Owens Rd | Done
- 3029 - Fridge Water Filter Replacement | No home linked in Notion | Done
- 11736 - Booked through Web/OR - asking for discount | No home linked in Notion | Done
- Timothy Griffith - $300 Refundable Deposit for the three pets. | No home linked in Notion | In progress
- 1 Star Dispute for AJ Geeslin | No home linked in Notion | Done
- 3712 - Order 94 Inche Curtains Panels. | No home linked in Notion | Done
- Process E-GC for Kyleigh | No home linked in Notion | Done
- 21036 - The bathroom next to the living room is starting to back up. | 21036 Owens Rd | Done
- 207 - sink in master is draining slow ( sink nearest closet )and the hot water heater ran  | No home linked in Notion | Done
- 21036 - plumbing seems to be backed up again. In the bathroom near the front foor | 21036 Owens Rd | Done
- 5512 - Track the order of the cart from Warr Acres | No home linked in Notion | Done
- 1152 - Guest Feedback | No home linked in Notion | Done
- 5047 - No hot water | No home linked in Notion | Done
- 504 - inspection for early checkout | No home linked in Notion | Done
- 509 - Trash Cart update | No home linked in Notion | Done
- 5253 - Carpet Cleaning | No home linked in Notion | Done
- Fraud Purchases - Amazon Redeem Rewards | No home linked in Notion | Done
- Airbnb - Carrie’s Group WiFi Issue - 1700 Whispering Creek Dr (Currently Hosting Apr 9-17) | No home linked in Notion | Done
- Airbnb - Kristen’s Group New Booking - Check-in Apr 16 (2 Days) - No Welcome Message Sent  | No home linked in Notion | In progress
- can you review all Daniels future tasks and make sure they are accepted. | No home linked in Notion | Done
- 11508 - Missing Cushion | No home linked in Notion | Done
- 2525 - Dsposal Not working | No home linked in Notion | Done
- Call Connor - 4 Star | No home linked in Notion | Done
- Call Lanette and Stephanie and Joseph for the 4STAR | No home linked in Notion | Done
- 3333 - confirm if sprinkler is working - owner | No home linked in Notion | Done
- Imported Notion ticket | No home linked in Notion | In progress
- 409 - Release the deposit | No home linked in Notion | Done
- Falisha - 4star | No home linked in Notion | Done
- William Nichols - LTR | No home linked in Notion | Done
- Imported Notion ticket | No home linked in Notion | In progress
- 13117 - Order the new Sofa | No home linked in Notion | Done
- 6017 - Order New Pot and Pans | No home linked in Notion | Done
- 1068 - Blind Broken | No home linked in Notion | Done
- 1012 - Broken Shower Head | No home linked in Notion | Done
- 11508 - Air intake filter replacement | No home linked in Notion | Done
- 3712 - Garage door key pad doesn’t work, Front door lock | No home linked in Notion | Done
- 1056 - The garage AND backyard is dirty + Wasps | No home linked in Notion | Done
- 1016 - co2 detector | No home linked in Notion | Done
- Aircover - Joshua Ramlal at 21036 Owens - nasty and stinks bad | 21036 Owens Rd | Claim review
- 21036 - Guest Bathroom Clogged | 21036 Owens Rd | Done
- Imported Notion ticket | No home linked in Notion | In progress
- Trash pick up - 11514, 2901, 7422 and 2522 | No home linked in Notion | Done
- 845 - Dryer doesn’t work. | No home linked in Notion | Done
- 7422 -  Driveway debris + Appliance haul off + Dining chair | No home linked in Notion | Done
- 4718 - Short glass is cracked | No home linked in Notion | Done
- 220 - Haul away some stuff + drywall damage + garbage disposal not working | No home linked in Notion | Done
- 136 - Dryer doesn’t work | No home linked in Notion | Done
- 2 STAR From Anthony Taylor | No home linked in Notion | Done
- 7351 - Bathroom flooded + no wifi | No home linked in Notion | Done
- 1600 - Compensate Kelly for AC issue | No home linked in Notion | Done
- 1640 - Trash and big spill in garage | No home linked in Notion | Done
- 11508 -  Painting + Stove | No home linked in Notion | Done
- 5253 - Guest feedback. | No home linked in Notion | Done
- 8708 | No home linked in Notion | Done
- Imported Notion ticket | No home linked in Notion | In progress
- 7422 - Dryer haul away | No home linked in Notion | Done
- 1152 - Guest feedback | No home linked in Notion | Done
- 628 - Guest feedback | No home linked in Notion | Done
- 504 - additional cleaning, trip charge, late checkout, etc | No home linked in Notion | Done
- Initiate your payment from Generali Global Assistance - As Micah for it. | No home linked in Notion | Done
- 721 Vaquero - microwave issue | No home linked in Notion | Done
- Imported Notion ticket | No home linked in Notion | In progress
- Send email for Yukon Homeowners (Cody’s Lawn Care) for Flower Bed Tuneup approval | No home linked in Notion | Done
- Send email for DFW Homeowners (Thomas’ Lawn Care) | No home linked in Notion | Done
- 11720 - spiders - schedule pest control - | No home linked in Notion | Done
- 16216 - Paint touch up | No home linked in Notion | In progress
- Imported Notion ticket | No home linked in Notion | In progress
- 3715 - missing ice maker cover | No home linked in Notion | Done
- Imported Notion ticket | No home linked in Notion | In progress
- 1152 - 845 - not drying again - schedule dryer vent cleaning | No home linked in Notion | Done
- 453 - order pan set + drinking glass + bowl | No home linked in Notion | Done
- Imported Notion ticket | No home linked in Notion | In progress
- Imported Notion ticket | No home linked in Notion | In progress
- Imported Notion ticket | No home linked in Notion | In progress
- 401 E 10th  - Property Turnover Maintenance Review & Owner Quote Preparation | No home linked in Notion | In progress
- 1016 - Order Coffee pot | No home linked in Notion | In progress
- Imported Notion ticket | No home linked in Notion | In progress
- 6629 S 22nd - Replacement of pans | No home linked in Notion | In progress
- 5217 - Departure Clean update | No home linked in Notion | In progress
- 136 - Departure Clean Report | No home linked in Notion | In progress
- Aircover - Sheritta Yarbrough at 1701 Park Lane Dr. - stained linen | No home linked in Notion | In progress
- VRBO - Shayla Pequeno at 3200 Birmingham Dr - dog waste smell + King sheets stained | No home linked in Notion | In progress
- Aircover - Justin Hasling at 1908 E Urbana St - carpet needs cleaning | No home linked in Notion | In progress
- Aircover - Lynne Delaney at 16401 Villa Valeria Way (30D FIRM) - nighstand | No home linked in Notion | In progress
