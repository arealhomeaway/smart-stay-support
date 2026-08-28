# Resolve beta — revised sequence under Emily's approved direction

Emily's answers are the operating direction. Resolve is still not beta-ready. Vendor portal paused; no live sends, dispatch, external writes, access changes, or automation activation without specific approval.

**Lane split:** Claude owns automatic assignment and contact population. This plan owns communication, notifications, files, Breezeway work orders, onboarding variants, quarterly placement and the Active Owner comparison. Shared files are listed in "Coordination" so we never edit the same thing.

## Corrections to my earlier reconciliation

- **Onboarding subtasks and dependencies exist — my earlier "missing" was wrong.** `onboarding_tasks` has `parent_task_id` and `depends_on[]`; `dependencyBlocked()` enforces prerequisites and the workspace renders subtasks indented and blocks dependent tasks. Nothing to rebuild. The real gap is **plan variants**: `onboarding-template.ts` holds exactly one plan (full furnishing) with no variant key.
- **Vocabulary is settled, not proposed:** Operations = **Ticket**. Breezeway **Work Order** = linked external field job only. Onboarding Project/Task/Subtask and Active Owner Action/Approval/Participation Entry unchanged. Labels only — no table or API renames.
- **Quarterly reviews** move out of Operations navigation to vendor management (supersedes the SOP's older placement). Records preserved, scheduler stays paused.

## Sequence (my lane — runs independently of Claude's)

**W1 — Files (foundation for evidence, onboarding and owner sharing).**
Storage recommendation first, then build after approval: private Cloud storage bucket as the system of record for in-app photos/videos/documents, persisting `documents.storage_path`; the approved ARHA Resolve SharePoint site stays a read-scoped connector, not the upload target — pushing staff uploads there needs a site-level write grant we do not have and have not requested. Access: staff upload and read; owners see only explicitly shared items and can upload requested documents; vendors submit in Breezeway this phase. No external file write until approved.

**W2 — Email intake category protocol** (build behind the existing paused switch; no live activation).
Only a message categorized exactly `Resolve: create task` creates a ticket. Order of operations: read the tagged message → create and confirm the saved ticket → only then PATCH the message's categories to `Resolve: task created`, preserving every unrelated category. On ticket close, set `Resolve task: task completed`. Duplicate protection by Graph `internetMessageId` + `conversationId` uniqueness, so a retry re-tags rather than re-creates. Replies keep landing on the existing ticket through the current `conversationId`/ref-tag linking; untagged mail never creates a ticket. Mailbox stays locked to info@arealhomeaway.com through the existing allowlist.

**W3 — Notifications.**
Staff alerts stay **in-app only** — notification store + bell for new assignment, pending handoff, urgent/overdue, vendor completion. No staff email or push, and the existing overnight escalation process is untouched: Resolve surfaces the urgent overnight ticket in-app to the rostered on-call person and does not replace, duplicate or automate the current escalation path. Owner approval requests go in-app + email + **web push** (Web Push/VAPID, per-user opt-in). Push support to state plainly in the UI: works on desktop Chrome/Edge/Firefox and Android; on iPhone/iPad only when the owner adds Resolve to the Home Screen (iOS 16.4+), and never without opt-in. Delivery state shown per channel (sent / failed / skipped-not-opted-in), reusing the `email_log` pattern. **Returned participation entry email notifications stay unwired pending approval** — the returned entry still shows in-app in the owner portal.

**W4 — Breezeway work orders (the beta-required set).**
`work_orders` link table: `ticket_id`, `external_system`, `external_id`, `origin` (resolve|breezeway), idempotency key, status, due date, assignee, external URL. Create in Breezeway from a Ticket (`POST /public/inventory/v1/task`), select vendor/assignee from the People API, set due date, show acceptance/status, and pull completion notes and photos. The receiver stops being event-log-only: a verified webhook updates the matching linked Work Order by `external_id` — retries update, never insert, so no duplicate jobs or loops. Reschedule, cancel and vendor messaging deliberately deferred. No real dispatch until the controlled test below is approved.

**W5 — Onboarding plan variants.** Add a variant key and build the three missing plans from your source exports: already furnished / no furnishing, partial furnishing / refresh, and existing property transitioning into ARHA management. Any rule the exports do not cover gets flagged, not guessed. Assignment, due dates, subtasks, dependencies, evidence, approvals and the handoff gate are reused as-is.

**W6 — Quarterly reviews relocation** (navigation + ownership only).

**W7 — Active Owner guide comparison.** The attached file is `ARHA_AOP_Review_Package_Branded.docx` — 44-page branded "Active Owner Program / Your First 90 Days" review package, undated, no version number on the cover. **Please confirm this is the final version before I treat it as authoritative.** Read differences already visible: 8 action types vs the app's approval/evidence/time model; six named meetings plus day-30/60/90 reviews that are not records; guide statuses (Not released, Ready, In progress, Submitted, Team review, Complete, Awaiting owner approval, Approved, Changes requested, Declined, Blocked, Not applicable) vs a shorter app set; versioned re-issue on material revision; business-day due dates (Mon–Fri, US federal holidays, property-local, 5 p.m., counted from next business day). The guide names individuals; the app will keep titles.

## Channel capability check (before promising anything)

| Channel | Verified capability | Limitation to accept now |
|---|---|---|
| OwnerRez guest conversations | Official v2 documents `GET /v2/messages?threadId=…` (thread history, `since_utc`, attachments) and `POST /v2/messages` (reply, with channel enum incl. Airbnb/Vrbo/Booking) | Documented capability ≠ our token's access. Needs a read-only probe with our credential before any reply UI is built. |
| info@ shared mailbox | Read + send through Graph, single-mailbox allowlist enforced in code | Microsoft-side restriction still unevidenced — an admin ApplicationAccessPolicy screenshot is the missing proof. Category PATCH is supported by Graph. |
| Owner email | Working today (`email_log`, owner alert drain) | Bounces not tracked. |
| Internal team | Comments and mentions exist on the ticket; nobody is notified today | Fixed by W3. |
| Telegram | A bot can post to, and read, a group **it has been added to**, and can DM only users who messaged it first | **It cannot access existing conversations, cannot read history from before it joined, cannot act as a person, and cannot see arbitrary DMs between staff and vendors.** "All Telegram messages" is not achievable through the bot API. Practical path: new per-property or per-vendor groups with the bot added, replies from the Ticket. |
| SMS | Not supported today — no SMS provider; the app deliberately turns urgent texts into a human call-the-owner task | Grasshopper not required for beta; leaving as-is. |

## Coordination with Claude (do not both touch)

- Claude: routing/assignment writes, contact population, `MatterOwnershipPanel`, guest-context server fn.
- Me: notifications, mailbox/intake, work orders, documents, onboarding template, quarterly nav, owner portal.
- Shared and therefore change-by-agreement only: `src/lib/tickets.ts`, `src/lib/matters.ts`, the ticket detail route, and any `tickets` migration. Label-only vocabulary changes touch presentation strings, never tables or API contracts.
- Handover already given to Claude: ownership-field semantics, handoff acceptance rule, coverage tables, audit sink, and the two Notion SOP links above as the authoritative routing source (functional job title = lane; scheduled coverage = person; unknown routing → Operations Supervisor with a stated reason; One-Touch Resolutions stay out of queues; one Ticket type with a Cross-Team flag; no automatic transfer of open tickets at shift change; the original guest point of contact keeps guest communication; lunch and single-PC coverage rules preserved; system-created work routes automatically; a PC's valid self-owned or manual assignment is never overridden outside handoff/reassignment).

## Proposed controlled test (approval required — nothing runs yet)

One end-to-end rehearsal, then full cleanup.

- **Property:** 9211 Fitzgerald Dr (the existing Breezeway pilot property — no other home is in scope).
- **Ticket:** a new demo Ticket, "Beta rehearsal — exterior light out", P3, created by me in Resolve.
- **Vendor / assignee:** the ARHA handyman already assigned to the Fitzgerald pilot in Breezeway; assignee chosen from the People API, not typed in.
- **Work order:** one Breezeway task created from that Ticket, title prefixed `[RESOLVE TEST — DO NOT ACTION]`, due date 2 business days out, description stating it is a system test and no work should be performed.
- **Recipient of any message:** Emily only (emily@…), through info@arealhomeaway.com. No vendor message, no guest message, no owner message.
- **Expected results:** Breezeway returns a task id; Resolve stores the linked Work Order with `origin=resolve`; status and acceptance appear in Resolve; a status webhook updates the same Work Order (no second record, no event-log-only outcome); completion notes and one photo pull back and display; in-app notifications fire for new assignment and vendor completion; one owner-approval push + email fires to a demo owner account, not a real owner.
- **Cleanup:** cancel/delete the Breezeway test task, delete the linked Work Order and demo Ticket, delete the test photo from storage, and report the before/after row counts for `breezeway_webhook_events` and `work_orders`.
- **Not in the test:** any real vendor contact, any guest or owner message, any historical import, any automation switch, any SharePoint write.

## Genuine blockers (decisions or external, nothing else)

1. Overnight coverage and the current vacant role holder in the coverage schedule — Claude's routing cannot resolve those slots. Not inventing them.
2. Authoritative owner-contact mapping for **all** owners: owner data lives in Notion and OwnerRez, and Resolve only holds contacts for Active Owner enrollees. Which system is authoritative for a non-enrolled owner's primary contact?
3. Approval for a read-only OwnerRez `/v2/messages` probe with our credential.
4. Approval for the controlled test above.
5. Storage decision approval (private Cloud bucket as system of record; SharePoint stays read-only) before any bucket or access configuration.
6. Microsoft-side mailbox restriction evidence, or written acceptance of app-side enforcement for beta.
7. Returned-entry notification channels (pending your answer).
8. Confirmation that the attached AOP package is the final guide version.
9. Onboarding variant source exports for the three non-full-furnishing plans.
