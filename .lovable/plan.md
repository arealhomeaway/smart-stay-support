# Part 3 check against the README (read only, nothing changed)

Checked: the code on main and the live database (triggers and function bodies). Not checked: the published version or a signed-in browser.

| # | Element | Result | Evidence (file:line) |
|---|---|---|---|
| 1 | Telegram group saves through save_home_detail_field | Built as written | src/lib/home-details.functions.ts:143-146; src/components/onboarding/home-details/HomeDetailsTab.tsx:218-222 |
| 1 | PM, Director of Onboarding, Admin edit; others read only | Built as written | src/lib/home-details.ts:80-85 (`lead \|\| isHomePm`); HomeDetailsTab.tsx:180 (`can()` is false when viewOnly, so `editor: null`); server checks again at home-details.functions.ts:123 |
| 2 | LOA status, same rules | Built as written | HomeDetailsTab.tsx:213-217; same rules as row 1 |
| 2 | Choices Not started, Sent, Signed, Not needed | Built as written | src/lib/home-details.ts:172-177 |
| 3 | Agreements and Estimates and invoices folders, upload into each | Built as written | home-details.ts:184 (estimate_invoice), 219-224 `uploadCategory`; HomeFilesTab.tsx:219-228 |
| 3 | Move to uses move_home_file | Built as written | HomeFilesTab.tsx:83, 96-102; home-details.functions.ts:161-168 |
| 3 | New files never go into Other | Partly | Files tab picks a folder first (HomeFilesTab.tsx:261, uploadCategory returns null for Other at home-details.ts:220). Task drawer uploads save first and are filed afterwards (src/components/AttachmentsPanel.tsx:322-327); if that second step fails the file stays in Other with a toast |
| 4 | Preferred button marked when set | Built as written | home-details.functions.ts:264, 277; home-details.ts:284-293 (sorted first); HomeVendorsTab.tsx:134-136 shows "(preferred)" |
| 4 | Editable where vendors are edited | Not built | No screen writes vendor_orgs.preferred_contact (searched src: only the read at home-details.functions.ts:264). Every vendor stays unmarked until someone sets it in the database |
| 5 | Notices for stage moves | Different | Live trigger followed_home_stage_notice fires on project event "Status changed" (the project Status field), not on a computed stage change. README says "Status moves", so it matches the README, not the word "stage" |
| 5 | Notices for handoff moves | Built as written | Live trigger followed_home_handoff_notice on onboarding_projects.handoff_state |
| 5 | Notice when an owner message is waiting | Built as written | Live trigger followed_home_owner_notice on owner_request_messages where author is the owner |
| 5 | Nothing emailed; changer not told | Built as written | Live private.notify_home_followers inserts email_status 'none' and skips `user_id = _actor` |
| 5 | Add to my homes button | Built as written | src/components/onboarding/OnboardingActivityFeed.tsx:89-116; home-details.functions.ts:312-328 |
| 6 | Text or guard that thinks the change is missing | Partly | src/lib/onboarding-home.server.ts:33 "This waits on a database change that is not applied yet. Nothing was saved." It shows only if the database function is missing (callStaged, line 397). Now that Part 3 is live it should never show for these features. No flag blocks them. Code comments still say "staged" (home-details.functions.ts:5, 161, 263; HomeFilesTab.tsx:6) but these are not on screen |
| 7 | Developer language on screen | Partly | (a) the same line from onboarding-home.server.ts:33 says "database change". (b) AttachmentsPanel.tsx:326 shows the raw server error: "File saved. Its folder could not be set: <error text>". Nothing else found in the Part 3 screens |

Stopped here. No code, data or switch was changed.
