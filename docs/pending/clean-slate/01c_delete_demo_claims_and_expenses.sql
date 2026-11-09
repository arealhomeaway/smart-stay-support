-- Clean slate, part 1c: delete the 9 demo claims that have no ticket and the 9 test expenses
-- (Emily, Nov 8, 2026; register N8, answer 3). STAGED ONLY. Do not apply without Emily's go.
-- Run after 01 and before 02. Refuses to run unless a full backup that finished and passed
-- Verify in the last 2 hours is recorded, and unless every id below still matches the title or
-- payee written next to it (so a typo can never remove a real record). Explicit list only.
--
-- Removes, for these records only: the claims with their activity and waivers (these go with
-- the claim automatically), the money-in entries on them, the expenses with their history,
-- links, statement decisions and money-in entries, their file records (the stored files stay in
-- storage), their work list rows and the alerts about the claims. A departure review and a
-- cleaning review that pointed at one of these claims are kept, just no longer linked.
-- Keeps: every other claim and expense, including the 7 demo expenses that were linked to the
-- deleted tickets and Work Orders (01 unlinks those; they stay unless Emily says otherwise).
--
-- Delete blocks switched off only inside this step and switched back on at its end:
-- expense_events_append_only (expense history), guard_expense_recovery (money-in entries),
-- guard_statement_dispositions (statement decisions). If anything fails, nothing changes.
-- Undo: none in SQL. Restore from the backup folder named in full_backups (README).

CREATE TEMP TABLE cs_claims (id uuid PRIMARY KEY, title text NOT NULL) ON COMMIT DROP;
INSERT INTO cs_claims (id, title) VALUES
  ('b7fbde89-d5e8-4f9d-93b2-3de1171da3c1', 'Departure damage — Pet damage'),
  ('2a822c00-0ff4-474f-a14c-45cfbffe4116', 'QA SYNTH — denied claim'),
  ('c03ec414-4882-4cf6-a7c2-77a4644a48ae', 'QA SYNTH — waiver approve'),
  ('f8bbc559-f78c-4813-b141-e6245ed14a8c', 'QA SYNTH — waiver deny / unverified deadline'),
  ('d41dafb4-eb13-4467-b9a0-e335013fadaa', 'QA SYNTH — partial recovery'),
  ('262af36e-b843-4ba0-8f6c-225ee8e218cd', 'QA SYNTH — denied claim'),
  ('e1aa27c0-7613-4370-9bf4-e13f21b05a5e', 'QA SYNTH — waiver approved'),
  ('e8f4cf2c-86dd-4a80-99ed-129dfe17d398', 'QA SYNTH — waiver denied / unverified deadline'),
  ('23823dfb-e79c-43d9-8ec7-7e60573a06ee', 'QA SYNTH — Finance receipts');

-- payee '' marks the one blank expense (archived, made by a test account, not marked demo).
CREATE TEMP TABLE cs_expenses (id uuid PRIMARY KEY, payee text NOT NULL) ON COMMIT DROP;
INSERT INTO cs_expenses (id, payee) VALUES
  ('be487bc2-8f18-4335-a3e2-c2999087540e', 'QA SYNTH typo'),
  ('8e4e99eb-1d55-48be-a54b-fb43cb41e3d2', 'QA SYNTH Plumbing (incomplete)'),
  ('d94593ed-bd0a-4c9d-bc3c-6cc8ce1eadd3', 'QA SYNTH Gutter Clean (Oct 5 browser)'),
  ('9249f929-af3f-4556-87aa-3b5dc7506d06', 'QA SYNTH Repair B'),
  ('b8cc35c0-2066-40f1-822f-88c429071c85', 'QA SYNTH Repair A'),
  ('9cb7ad7b-a6ad-42b7-b7e3-3e5027fe8d3d', 'QA SYNTH Plumbing Co'),
  ('8106ce05-6c40-4b2b-a22a-aa03c9f7482d', 'QA SYNTH Plumbing Co'),
  ('95c5899a-e9a5-4647-9a39-dad5fef596d0', 'QA SYNTH Plumbing Co'),
  ('574e104e-6453-4d27-95ee-b704797df376', '');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.full_backups
     WHERE status = 'succeeded' AND verify_ok IS TRUE AND finished_at >= now() - interval '2 hours'
  ) THEN
    RAISE EXCEPTION 'Clean slate refused: no checked full backup in the last 2 hours. Press Back up everything, then Verify, then try again.';
  END IF;
  IF (SELECT count(*) FROM public.claims c JOIN cs_claims x ON x.id = c.id
       WHERE c.title = x.title AND c.is_demo AND c.ticket_id IS NULL) <> 9 THEN
    RAISE EXCEPTION 'Clean slate refused: a claim in the list is missing, renamed, real or has a ticket.';
  END IF;
  IF (SELECT count(*) FROM public.expenses e JOIN cs_expenses x ON x.id = e.id
       WHERE coalesce(e.payee, '') = x.payee
         AND (e.is_demo OR (x.payee = '' AND e.archived_at IS NOT NULL AND e.amount IS NULL
                            AND e.created_by = 'ec5405ff-4722-4a85-a22e-069e68bd3c7f'))) <> 9 THEN
    RAISE EXCEPTION 'Clean slate refused: an expense in the list is missing or changed.';
  END IF;
  -- Nothing outside the lists may depend on them.
  IF EXISTS (SELECT 1 FROM public.expense_links l WHERE l.link_type = 'claim' AND l.target_id IN (SELECT id FROM cs_claims)
               AND l.expense_id NOT IN (SELECT id FROM cs_expenses))
     OR EXISTS (SELECT 1 FROM public.expense_recoveries r WHERE r.claim_id IN (SELECT id FROM cs_claims)
               AND r.expense_id IS NOT NULL AND r.expense_id NOT IN (SELECT id FROM cs_expenses))
     OR EXISTS (SELECT 1 FROM public.expense_links l WHERE l.expense_id IN (SELECT id FROM cs_expenses)
               AND l.link_type IN ('ticket', 'work_order')) THEN
    RAISE EXCEPTION 'Clean slate refused: another record depends on a claim or expense in the list.';
  END IF;
END $$;

ALTER TABLE public.expense_events DISABLE TRIGGER expense_events_append_only;
ALTER TABLE public.expense_recoveries DISABLE TRIGGER guard_expense_recovery;
ALTER TABLE public.statement_dispositions DISABLE TRIGGER guard_statement_dispositions;

-- Alerts about the claims.
DELETE FROM public.staff_notifications WHERE entity_type = 'claim' AND entity_id IN (SELECT id FROM cs_claims);
-- File records on the claims and expenses (the stored files stay in storage).
DELETE FROM public.documents
 WHERE (entity_type = 'claim' AND entity_id IN (SELECT id FROM cs_claims))
    OR (entity_type = 'expense' AND entity_id IN (SELECT id FROM cs_expenses));
-- Work list rows.
DELETE FROM public.work_items
 WHERE (source_table = 'claims' AND source_id IN (SELECT id FROM cs_claims))
    OR (source_table = 'expenses' AND source_id IN (SELECT id FROM cs_expenses));
-- Links, money-in entries, statement decisions and history of the expenses.
DELETE FROM public.expense_links WHERE expense_id IN (SELECT id FROM cs_expenses);
DELETE FROM public.expense_recoveries
 WHERE claim_id IN (SELECT id FROM cs_claims) OR expense_id IN (SELECT id FROM cs_expenses);
DELETE FROM public.statement_dispositions WHERE expense_id IN (SELECT id FROM cs_expenses);
DELETE FROM public.expense_events WHERE expense_id IN (SELECT id FROM cs_expenses);
-- The expenses and the claims (claim activity and waivers go with the claim).
DELETE FROM public.expenses WHERE id IN (SELECT id FROM cs_expenses);
DELETE FROM public.claims WHERE id IN (SELECT id FROM cs_claims);

ALTER TABLE public.expense_events ENABLE TRIGGER expense_events_append_only;
ALTER TABLE public.expense_recoveries ENABLE TRIGGER guard_expense_recovery;
ALTER TABLE public.statement_dispositions ENABLE TRIGGER guard_statement_dispositions;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.claims WHERE id IN (SELECT id FROM cs_claims))
     OR EXISTS (SELECT 1 FROM public.expenses WHERE id IN (SELECT id FROM cs_expenses)) THEN
    RAISE EXCEPTION 'Clean slate check: a listed claim or expense remains.';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname IN ('expense_events_append_only', 'guard_expense_recovery', 'guard_statement_dispositions') AND tgenabled = 'D') THEN
    RAISE EXCEPTION 'Clean slate check: a delete block is still off.';
  END IF;
END $$;
