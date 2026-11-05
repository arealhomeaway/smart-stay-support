# Guided ticket checklists: pending

Status: Step 0 inventory only. No code, no database change, nothing applied.
Seed templates wait for the six checklists' step text from Emily's doc "Resolve Ticket Checklists: Draft for Review".

## Step 0 inventory (read-only, Nov 4 2026)

| Already exists | Where | What it does today |
|---|---|---|
| Playbooks (versioned, approved guidance) | `playbooks`, `playbook_steps`; `src/lib/playbooks.ts`, `playbook-match.ts`; plan `.lovable/plan/contextual-playbooks-implementation-plan-v2-2026-09-02.md` | 29 playbooks (14 active), 114 steps. Each has `playbook_key`, `version`, `status` (draft, in review, approved, retired), `supersedes_id`, `source`/`source_refs`, `matcher`, `required_evidence`. Supervisors author; Director approval where `requires_director`. Steps are a flat ordered list: `instruction`, `detail`, `required`, `photo_required`. No answers, no branching, no action links. Rule from the plan: playbooks never restate dollar amounts or SLAs. |
| Work types and routing | `work_types` (21 rows, all active; the "23-type catalog" is 21 today) | `default_priority`, `response_minutes`, `action_start_minutes`, `completion_target`, `clock_type`, `required_closure_evidence`, `guest_communication_required`, `functional_role_code` (seat), `backup_coverage`, `playbook_id`. Drives routing, SLA and closure. |
| Routine controls and forms | `routine_controls`; `src/lib/routine-controls.ts` | Code-defined step lists (`ROUTINE_CONFIG`) with outcomes looks good, needs follow-up, no answer, not applicable. Separate from tickets. |
| Ticket guidance and Next action | `src/lib/ticket-guidance.ts` (`ticketGuidance`, stages, resolution paths, `activeGuestStay`), `src/lib/ticket-next-action.ts` (`ticketNextAction`) | Picks the one current action and its save. |
| Ticket tracker and Do this now | `src/lib/ticket-cleanup.ts` | Logged, Tell the guest, Fix it, Make it right, built from ticket state. |
| Dispatch sequence | `src/lib/dispatch-next-step.ts` | Vendor, acceptance, authorization, appointment, then Breezeway or email. |
| Authority rules | `RECOVERY_POLICY` + `evaluateAuthority` (refunds); `evaluateAuthority` in `src/lib/work-orders.ts` (repair bands, emergency exception) | Single sources, mirrored by database guards. |
| Feature flags | `feature_flags` table, `src/lib/feature-flags.ts` (`FLAG_KEYS`) | Admin-toggled switches. |
| Ticket steps and answers | `ticket_steps`, `ticket_troubleshooting_answers`, `troubleshooting_guides` | Per-ticket step records and troubleshooting answers. |

## Reuse plan (decided)

1. **Templates are playbooks.** A checklist is a playbook with a `checklist` body: each step gets an id, question, answer options, the next step for each answer, required fields, an optional action key, and an `sop_url` placeholder on the template. It uses the existing `version`, `status`, approval and `supersedes_id`, so publishing an edit creates a new version and nothing is invented. Editing stays Supervisor or Director as today, narrowed to Admin and Operations Director for checklists.
2. **Version pinning** goes on the ticket (one new nullable column for the playbook version id) and is set only at creation. Open tickets have none, so they keep today's flow.
3. **Answers** are recorded in `ticket_steps` (who, when, answer, "doesn't apply" reason). Each answer also writes a `ticket_activity` line. No new answer table, unless `ticket_steps` cannot hold the answer shape, in which case it gets columns rather than a parallel table.
4. **Do this now** stays the one card. When a pinned checklist exists, `ticketNextAction` returns the current checklist step. Its action keys open the existing refund form, Work Order, vendor picker, dispatch sequence, calendar block and purchase paths. "Waiting on someone?" is the existing waiting control. The tracker reads the checklist's stage tags.
5. **Category picker** is a display layer: each category maps to an existing work type id. Routing, seat, SLA and priority come from that work type unchanged. The template can only suggest a starting priority through the existing priority rules, for example lockout with an active guest = P1. Active guest = in home or arriving within 48 hours, using `activeGuestStay`.
6. **Limits** are never stored in templates. A step that needs one calls `evaluateAuthority` or `RECOVERY_POLICY`.
7. **Rollout:** one `FLAG_KEYS` entry per category, all off. Off means today's form and flow.
8. **Prefilled facts** come from data Resolve already reads (OwnerRez stay and arrival, reservation, the home's lock system, last stay, next clean), shown for the coordinator to confirm.

## What was built (code, all categories off)

- Rules: `src/lib/ticket-checklists.ts` (walking, branching, "doesn't apply", active guest, starting priority, repair bands via `evaluateAuthority`, refund limits via `RECOVERY_POLICY`). Seed text: `src/lib/ticket-checklist-seed.ts`; `scripts/gen-ticket-checklist-seed.ts` writes `02_seed_ticket_checklists.sql`.
- Ticket: `ChecklistStepCard` sits at the top of "Do this now" only when the ticket was pinned to a checklist version at creation. Existing vendor/work order tools stay one click away. Answers go to `ticket_steps` (step_key rows) and ticket activity; the guest step saves the same guest update as before.
- New ticket: category tiles appear only when at least one category switch is on; each picks the existing situation, so work type, seat, SLA and priority rules are unchanged. "Other" shows today's work type picker. Work type stays visible under Details > About this ticket.
- Editor: `/ticket-checklists` (tab next to Playbooks). Admin or Director of Operations edit and publish a new version through `publish_ticket_checklist`; others view. Until step 01 is applied it shows the seed text read-only.

## Apply order (Emily approves)
1. `01_ticket_checklists.sql`  2. `02_seed_ticket_checklists.sql`  3. Turn on one category switch at a time.
Undo in reverse: `02_undo_...`, then `01_undo_...`. Checksums in `SHA256SUMS`.

## Not built yet
Automatic repeat-cleaner check, lock-check flag on the home, claim deadline reminder, and calendar block (step shows guidance only). Seed step 8 cleaning is a manual "Checked".
