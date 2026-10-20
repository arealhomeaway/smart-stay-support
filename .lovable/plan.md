# Read-only status report — Oct 20, 2026

Nothing was changed. Every check below was read-only.

## 1. Live version
- Live build: `index-HTW9UaHZ.js` (it changed since `index-u3pXaMXU.js`, so a publish happened after Oct 12).
- Commit for that build: Not verified. Builds aren't tagged with commit IDs.
- ee9584a5 (hours counting): live. It is part of every later version.
- 19d68858 (bell scroll/click + onboarding emails): live. The new scrolling bell list is in the live files.
- fa469650 (notifications open the Opportunity): probably NOT live. Its link-reading code wasn't found in the live files, but code can be renamed when the site is built, so this is Not verified for certain.

## 2. Database changes since the v3 release (785d512a, Oct 8)
- 0149 (Oct 16): onboarding notifications now ask to be emailed (demo ones never are), and the active Onboarding Director seat holder gets every homeowner Opportunity alert. Applied.
- 0150 (Oct 16): Opportunity alerts link to the Opportunity itself, not the internal Task. Applied.
- No other database changes are recorded in the project. Direct changes made outside migrations: Not verified, because I can't read the database's change history.

## 3. Email since Oct 16, 13:45 UTC
- Staff notification emails: **0 sent, 0 failed, 40 still waiting**. They go back to Oct 16, 17:51 UTC, for 4 teammates (Opportunity completions and homeowner collaboration). None has been tried yet (0 attempts, no error saved). **So the team still isn't getting these emails.** The cause isn't confirmed. Most likely the step that checks each recipient's access fails on every run, and the email is then left waiting without an error being saved.
- Staff emails to non-ARHA addresses: 0.
- Homeowner emails: 4 owner alerts sent, plus 2 Help & Feedback emails. All 6 succeeded.
- Repeated or looping sends: none. Each recipient and subject appears once.

## 4. Open items from Oct 9
- 9 internal Tasks showing to homeowners on Fitzgerald, Buckland and 3915 W 104th, and their plan flags: Not verified this pass.
- 3915 W 104th: **still two dates**. The home record says 2026-09-24; the Active Owner program says 2026-09-23 (confirmed).
- Linder account link history: Not verified. No correction note was found in the recent audit log.
- Welcome email wording: **still Draft**. 0 welcomes queued or sent.
- Vendor Ticket view (sensitive columns): Not verified this pass. No change to it was found since Oct 9.
- "[timing]" placeholder in the Linder Opportunity: Not verified. I couldn't find where that Opportunity is stored this pass.

## 5. Other changes since Oct 9
- Linders' program is still Draft with no start date.
- Recent activity: normal staff file uploads, homeowner attention flags and clears, and one homeowner response request (Oct 16) plus one resolution. Nothing unusual.

## Suggested next step (needs your approval)
Find out why the 40 staff emails are stuck waiting, then fix it, and publish fa469650. The stuck emails would go out once fixed. You may want to decide whether the older ones should still be sent.
