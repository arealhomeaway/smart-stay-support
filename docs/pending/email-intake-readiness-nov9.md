# Email intake readiness (report only), Nov 9, 2026

Checked against the code, the database and the Outlook connection as they are on Nov 9 at about 14:50 UTC.
Nothing was changed, published, sent or read from the inbox. The only Microsoft calls were two
read-only settings checks: which account the connection signs in as, and the list of category
names in that inbox. No email was opened or listed.

Target: email intake switched on, tested and working by Monday, Nov 16.

---

## 1. State today

| Item | What is true now | Evidence |
|---|---|---|
| "Email intake" switch (feature_flags `email_intake`) | Off, since it was created Aug 26 19:20 UTC. Never changed. | feature_flags row |
| Does the switch do anything? | **No.** It is listed in `src/lib/feature-flags.ts` and nothing reads it. The notification route, the timed sweep, "Run intake now", "Preview" and "Refresh notifications" all ignore it. | `src/lib/feature-flags.ts:21`; no other reference in `src/` |
| Timed sweep (`resolve-mailbox-sync`, every 10 minutes) | **Off** (cron job inactive). Last run Aug 24 16:30 UTC, succeeded. | cron.job / job_run_details |
| Live notifications from Microsoft | **Expired.** The last subscription was made by hand on Sep 1 23:52 UTC and ran out Sep 4 22:22 UTC. Only the timed sweep renews it, and that is off. The database row still says "active", so the Integrations panel wrongly shows "Live notifications". | integration_events system `outlook_subscription` |
| Activation line (checkpoint) | Set to **Sep 1, 23:20:20 UTC**. | integration_events operation `processing_checkpoint` |
| Last intake activity | Sep 2 00:04 UTC (a QA test). 16 message records from the Sep 1 QA tests (QA TEST 2 and 3): create, reply on the same thread, Team A, Team B, Needs Triage and Direct Bookings folders, a moved message, and "ticket closed" write-back all worked. The tickets and requests they made were later removed by the clean slate. | integration_events |
| Last error | None recorded. No failed message records. One claim from Sep 1 23:49 was left "processing" (no subject saved). | integration_events |
| Mailbox | info@arealhomeaway.com (the `EMAIL_SOURCE_MAILBOX` secret matches it). | secret compared without showing it |
| Microsoft 365 connection | **Valid today.** "ARHA Info Outlook Connector", linked to this project, signed in as info@arealhomeaway.com itself (display name "Customer Service"). A profile read returned OK. | connection check, Graph `/me` |
| Permissions held | Mail.Read, Mail.ReadWrite, Mail.Send, Mail.ReadBasic (delegated, the account's own mailbox). | connection configuration |
| Can Resolve read categories and write them back? | **Yes, by permission.** Because the connection is signed in as the info inbox itself, Mail.ReadWrite covers reading and changing categories on that inbox; no "shared" permission is needed. Write-back was proven on Sep 1. Not re-tested today (that would change an email). | Sep 1 records; scopes |
| Category names that exist in the info inbox | Resolve: create ticket, Resolve: direct booking, Resolve: ticket created, Resolve: ticket closed, Resolve: owner approval response. **Missing:** Resolve: owner response received (Resolve writes it anyway; Outlook shows it without a colour). The old lead tag and the retired task tags are not in the list. | Graph masterCategories |
| Other secrets needed | LOVABLE_API_KEY, MICROSOFT_OUTLOOK_API_KEY, LOVABLE_CRON_SECRET, EMAIL_SOURCE_MAILBOX: all present. PUBLIC_SITE_URL is not set; the code falls back to https://smart-stay-support.lovable.app, which is correct. | secrets list |
| Published code | The live site runs the last published version. The Nov 9 change (old lead tag retired) is not published. | publish rule |

**What I cannot see from here:** whether info@ is a licensed user or a shared mailbox with sign-in allowed;
any Microsoft 365 policy that could end the sign-in (password change, MFA or conditional access);
how many messages in the inbox already carry a Resolve category (seeing that means reading the inbox);
Owl Marketplace's real subject lines and reply handling; real notification delay (needs a live test).

---

## 2. How new mail is detected

Two paths, built:
1. **Push notification (fast path).** Microsoft calls `/api/public/hooks/outlook/messages` when any message in the info inbox, in any folder, is created or changed (applying a category is a change). Resolve reads the message back and decides from its categories. Typical delay is seconds; Microsoft gives no guarantee.
2. **Timed sweep (safety net).** `/api/public/sync/mailbox` every 10 minutes; it also renews the push subscription (lasts about 3 days, renewed when under 12 hours remain). It asks only for messages carrying a trigger category, up to 50 per run, oldest first.

**Real delay today:** none, both paths are off.
**When on:** seconds by push. If a push is missed, up to 10 minutes or more (50 per run, no paging).

**Can it meet the Direct Booking clock (D3: within about a minute)?** Only while push works. The safety net
at 10 minutes cannot. Note the 3 minute clock itself starts when the request exists in Resolve
(`src/lib/direct-bookings.ts:310-325`), so a late request does not look late in Resolve; the partner simply waits.

There is no handling of Microsoft's "subscription removed" warnings (no lifecycle address); recovery relies on the sweep.

Smallest fix: run the sweep every minute (the database scheduler already runs one job every 20 seconds), keep push as the fast path.

---

## 3. What happens when it is switched on

"Switching on" today means turning on the timed sweep (and that also recreates the push subscription), or pressing "Refresh notifications" or "Run intake now". The `email_intake` switch is not consulted.

- **Backfill?** The sweep does not start from now. It uses the saved activation line, **Sep 1 23:20 UTC**. So the first runs would look at **every message received since Sep 1 that carries Resolve: create ticket, Resolve: direct booking or Resolve: Owner Approval Response**, in any folder, 50 per run, oldest first, and would create a Ticket or request for each one not already recorded. If anyone has been tagging mail since Sep 1, or if Emily's Outlook rule starts tagging partner mail before switch-on, all of it would become work at once.
- **Push path has no activation line at all.** It never checks the checkpoint (`processMessage` in `src/lib/mailbox.server.ts:442-566`). A message from any date that someone tags today would become work.
- **Retired task tags and the old lead tag:** on their own they create nothing (old "task created"/"task completed" count as already handled; the old lead tag and "create task" are ignored). But if a person adds a current trigger tag to an old message that has no Resolve record, it **is** created; the old tags do not block it.
- **Once-per-message record:** yes. Every message is claimed by both its Outlook id and its internet id under a unique index (`integration_events_mailbox_once`) before anything is created. The 16 Sep 1 test messages keep their records, so they can never create again.
- **Other first-run effects:** the Sep 1 claim left "processing" becomes reclaimable after 10 minutes (if that message carries a trigger tag, it is created then). Three Sep 1 QA messages marked "ticket closed" would be re-tagged "Resolve: ticket created" because their records were removed in the clean slate (harmless, but wrong).

**Smallest safe safeguard (none of this exists today):**
1. Make every path (push, sweep, Run intake now, Preview, Refresh notifications) refuse while `email_intake` is off.
2. When the switch is turned on, move the activation line to that moment (the code only ever moves it forward).
3. Make the push path ignore any message received before the activation line.

---

## 4. The flows as built

### Resolve: create ticket
1. A person (or rule) applies the tag. Push or sweep reads the message.
2. Claimed once per message; if the subject or preview names an existing ticket ([ARHA-123]) it is filed as a note there instead.
3. If the thread already produced a Ticket or request, the email is added as a note on it and nothing new is created.
4. Otherwise a Ticket is created (`src/lib/intake.server.ts:147-170`):
   - Title: the subject (200 characters).
   - Description: "From: sender" and the email text (tags removed, up to 4,000 characters).
   - Sender: text inside the description only.
   - Attachments: names, types and sizes of up to 20 are kept on the email record; **files are not copied**. Staff open the email from the Ticket to see them.
   - Home: best match of an active home's name or nickname in the subject or text (4+ characters); else none.
   - Work type / problem type: **none**. Category guessed from words (safety, cleaning, access, quality, maintenance).
   - Priority: from words (Right now / Today / Routine).
   - Owner: **none** (`drizzle/migrations/0296_fix_batch_4_automated_sources_unowned.sql`, applied).
   - Group: "From email" in the Team Queue.
   - Team: **none**, because there is no work type or role. It shows under Team A, Team B and All teams until someone takes it. (T15 says "their team's group": not met.)
   - Clock: from the moment the Ticket is created in Resolve, not when the email arrived.
5. Resolve swaps the tag for **Resolve: ticket created**, keeping any other category the team uses.

### Resolve: direct booking
1. Same claim and thread rules. A tagged reply on a thread already in Resolve is added as a note on that request.
2. Creates a Direct Booking request (`leads.kind = direct_booking`, `src/lib/outlook-lead.server.ts`):
   - Contact name: the sender's display name, else the part before @.
   - Email: the sender's address (this becomes the default reply address).
   - Phone: the first US phone number in the text.
   - Company: made from the sender's domain (owlmarketplace.com becomes "Owlmarketplace").
   - Source: relocation / insurance / corporate / realtor / referral / website only when those words appear; else "email", marked unconfirmed.
   - Requirements: the first 2,000 characters of the text. Dates, guests, pets, bedrooms, area and budget are **not** read into their boxes.
   - Partner (Referral source / Inquiry Source) and partner name: **not set**. The coordinator picks it; the partner rent rules apply only after that.
   - The email link, received time and attachment list are kept.
3. Shown on Direct Bookings, Open view, as a new request.
4. Alert: the new-request alert goes to an available Guest Experience coordinator, then other available coordinators, then the lunch tiers, then the Operations Supervisor and Director of Operations. Overnight (10 PM to 8 AM) nobody is alerted until the morning release.
5. Clock: 3 minutes from when the request exists in Resolve; overnight from 9:00 AM.
6. Tag swapped to Resolve: ticket created.

### Resolve: ticket created / Resolve: ticket closed
- **Created:** written by the same pass right after the record saves. If writing fails, the record stays and the next pass retries the tag only.
- **Closed:** written by the timed sweep only (not at the moment of closing): when the Ticket's status is Closed, or the request is Booked/Not booked (converted/lost). Up to 25 changes per sweep. If a Ticket reopens, the tag goes back to Resolve: ticket created. Archiving a Ticket does not close it, so its email keeps "ticket created".
- With the sweep off, "closed" is never written.

### Resolve: Owner Approval Response / Resolve: owner response received
- A person tags a homeowner's reply. It is checked before the other tags.
- Resolve files the reply against the waiting owner approval it answers: by approval reference, then the email thread, then the sender's address; exactly one match is required. No match or more than one: held for someone to place. Resolve never reads "yes" or "no" from the words.
- Then writes Resolve: owner response received. If that write fails, the retry does not handle this tag correctly (gap).

### Replies and two tags
- **Reply (RE:) with a trigger tag, thread already in Resolve:** note on the existing record; no second one.
- **Reply with a trigger tag, thread not yet in Resolve:** a **new** Ticket or request. "RE:" is not checked.
- **Reply with no tag:** nothing, unless it names [ARHA-123], then a note on that Ticket (push path only).
- **Two Resolve tags:** Owner Approval Response wins over both; Direct booking wins over Create ticket. One record only.

---

## 5. Failures

| Case | What happens |
|---|---|
| Duplicates | One record per message (unique index on both ids). Push and sweep racing: the loser walks away. Thread replies link to the first record. Weak spots: the 10-minute stale-claim takeover and [ARHA-n] notes are not fully race-proof (no duplicate seen in tests). |
| Failed write-back | Record stays; error "recategorise_pending"; next pass retries the tag only. Owner-response tags are not retried correctly. |
| No sender | Ticket says "unknown sender"; request contact "Unknown contact", no email (reply needs an address typed in). Not refused. |
| No body | Ticket/request created with an empty description. Not refused. |
| Large attachments | Not downloaded, so size never fails. Only the first 20 names are kept. |
| Create fails | Message record marked failed with the reason; not retried automatically (a person must look). |
| Microsoft read fails | Sweep reports an error for the run; push failures are only written to the server log. |
| Where an Admin sees it | Integrations page, inbox panel: connection, notification status, Preview, Run intake now, Refresh notifications, recent messages with outcome and reason, failures. Supervisors and above can press the buttons. |
| What the team sees | Only the result: a new "From email" Ticket in the Team Queue, a new Direct Booking request, a note on an existing record. Failures are not shown to coordinators. |

Also found: the sweep's address accepts the public project key (what the scheduler sends) as proof of identity, and that key is public. Anyone could make it run a pass (it can still only act on tagged mail). The other scheduled jobs use the private scheduler secret.

---

## 6. Safe test plan

**Gap first:** nothing marks an emailed test. A test Ticket or request is real: it alerts coordinators, sits in the Team Queue and Direct Bookings, starts clocks and counts. Cleanup: a Ticket can be archived with a reason (Admin or Supervisor); a Direct Booking request has no archive, only Not booked after a reply.

**Smallest fix:** a subject that starts with `[RESOLVE TEST]`, sent from an @arealhomeaway.com address, creates the record marked as a test (the existing demo marking, which outbound email already refuses). Needs a short build and Emily's yes.

Run during staffed hours, after telling the on-shift coordinators. One person sends each email to info@ from an ARHA address, then applies the tag by hand (or lets the rule do it).

| # | Send | Expect in Resolve | Expect in Outlook |
|---|---|---|---|
| 1 | `[RESOLVE TEST] AC not cooling at <real home name>`, tag Resolve: create ticket | Within a minute: one Ticket in Team Queue, From email, no owner, the home matched, priority from words, sender in description | Tag becomes Resolve: ticket created |
| 2 | Reply on test 1's thread, tag Resolve: create ticket | Note on the same Ticket; no new Ticket | Resolve: ticket created |
| 3 | Reply on test 1 with no tag | Nothing | Unchanged |
| 4 | `[RESOLVE TEST] Housing request, relocation, 3 months`, tag Resolve: direct booking | Within a minute: one request in Direct Bookings, Open; alert to the on-shift coordinator; clock 3 minutes | Resolve: ticket created |
| 5 | Same as 4 but sent at a time the Outlook rule is live, no hand tag | Same as 4 (proves the rule) | Same |
| 6 | Message with both tags | One request only | Resolve: ticket created |
| 7 | Message tagged with the old lead tag only | Nothing | Unchanged |
| 8 | Old message (received before switch-on) tagged now | Nothing (needs safeguard 3) | Unchanged |
| 9 | Close test 1's Ticket | Next sweep | Resolve: ticket closed |
| 10 | Owner reply test: reply to a test owner approval, tag Resolve: Owner Approval Response | Reply filed on the decision or held to place | Resolve: owner response received |

**After:** each message has exactly one record on the Integrations panel; no failures; times from email
arrival to record (from the received time saved on the record); archive each test Ticket with the reason
"Email intake test" and mark each test request Not booked (or remove by the test marking); confirm Team
Queue and Direct Bookings counts are back to where they were.

---

## 7. Readiness list

| # | Must be true | Who | Size |
|---|---|---|---|
| 1 | The switch really controls intake: every path refuses while off | Claude (build) | small |
| 2 | Turning it on sets the activation line to that moment | Claude (build; staged step if done in the database) | small |
| 3 | The push path ignores mail received before the activation line | Claude (build) | small |
| 4 | Sweep every minute, using the private scheduler secret (staged database step, applied on approval) | Claude, Emily approves | small |
| 5 | Test marking for `[RESOLVE TEST]` mail | Claude (build), Emily decides | medium |
| 6 | Integrations panel shows "expired" when the notifications have run out | Claude | small |
| 7 | Owner-response tag retry fixed; removed records not re-tagged | Claude | small |
| 8 | Decide team for email Tickets (none today; option: Team A / Team B folder sets the team) | Emily decides, Claude builds | small to medium |
| 9 | Decide partner recognition (match a sender domain or a name in the text to an Inquiry Source; portal senders such as noreply do not become the reply address) | Emily decides, Claude builds | medium |
| 10 | Publish with Emily's approval (the live site must have the Nov 9 tag change and the fixes above) | Emily | small |
| 11 | Before switch-on, check no message since Sep 1 carries a trigger tag (or rely on fix 2) | Emily in Outlook, or Claude with permission to read tag counts | small |
| 12 | info@ sign-in stays valid: no password change or MFA prompt that ends the connection; if it breaks, reconnect in Lovable connector settings | Microsoft 365 admin, Emily | small |
| 13 | Add "Resolve: owner response received" to the inbox's category list (optional, colour only) | Emily or Microsoft 365 admin | small |
| 14 | Outlook rule for partner requests, with the exclusions in section 8 | Emily | small |
| 15 | Run the test plan, then turn on | Emily and Claude | medium |
| 16 | Lovable: nothing extra needed; the connection is linked and valid | Lovable | none |

---

## 8. Outlook rule facts

What the intake does with a message the rule tags Resolve: direct booking:
- **It creates a request for anything tagged**, whatever it says. There is no check that it is a request.
- **A reply (RE:) in a thread already in Resolve:** added as a note on that request; no new one.
- **A reply (RE:) or forward (FW:) in a thread not in Resolve:** a **new** request.
- **A partner's reply to our quote:** if tagged, a note on the request (fine); if the portal starts a new thread for each message, a new request (wrong).

So the rule must exclude: subjects starting RE:, FW:, FWD:; mail from @arealhomeaway.com (our own sends and copies); automatic replies and delivery failures; and any portal notice that is not a new request (confirmations, guest messages, reminders). Best: the rule matches the exact subject phrase the portal uses for a new request.

**Can a partner be recognised from noreply@owlmarketplace.com?** Not today. The intake never looks up Inquiry Sources. The request would show contact "noreply" (or the portal's display name), company "Owlmarketplace", email noreply@owlmarketplace.com, and source "relocation" only if the text says relocation or names Sirva, Cartus, Graebel or Aires. A relocation company named in the text is **not** picked out. The coordinator must set the partner, and must check the reply address: the default reply goes to the sender, which here is a no-reply address.
