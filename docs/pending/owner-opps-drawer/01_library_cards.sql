-- Owner Opportunities and Task Drawer, staged file 01 (approved by the Admin, Nov 11). Part C1.
-- Apply order: 01, then 02. Undo in reverse: 02 undo, then 01 undo.
-- 1. Retire 5 Optional Library cards that repeat plan cards (kept, never deleted; Opportunities
--    already started from them stay as they are). Each retirement is an audit_log row.
-- 2. Add the 3 unique Optional Library cards to the card library as released "anytime" cards,
--    copied from the library wording, with version history. No hour estimate is stored.
-- 3. Mark N05, N06, N07, N08, N12, P16, P17, P18 as once per owner, each with a history row.
-- Acts as the approving Admin so every change records who and when. Repeats change nothing.
-- Nothing is released to a home, sent or emailed: new cards reach a home only when its plan starts.
SELECT set_config('request.jwt.claims', json_build_object('sub','98bd6696-4018-4965-b645-0471c5ae3925','role','authenticated')::text, true);
SELECT set_config('request.jwt.claim.sub', '98bd6696-4018-4965-b645-0471c5ae3925', true);

-- Additive column (default false keeps every other card exactly as it is).
ALTER TABLE public.ao_library_cards ADD COLUMN IF NOT EXISTS once_per_owner boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.ao_library_cards.once_per_owner IS
  'Market and relationship research: the homeowner sees one card for all their homes; answering it completes every home''s copy (ao_submit_card).';

-- 1. Retire five Optional Library cards (owner_opportunity_library.active = false), with receipts.
WITH retired AS (
  UPDATE public.owner_opportunity_library SET active = false, updated_at = now()
   WHERE active AND title IN ($t$Build a local area & dining guide$t$, $t$Research seasonal events & demand drivers$t$, $t$Research comparable furnished rentals$t$, $t$Review listing positioning$t$, $t$Review your property's guest journey$t$)
  RETURNING id, title
)
INSERT INTO public.audit_log (actor_id, action, entity_type, entity_id, entity_label, reason, before_value, after_value)
SELECT '98bd6696-4018-4965-b645-0471c5ae3925', 'owner_library_retired', 'owner_opportunity_library', id, title,
       'Repeats a plan card (Owner Opportunities build, Nov 11)', jsonb_build_object('active', true), jsonb_build_object('active', false)
  FROM retired;

-- 2. Three unique Optional Library cards become released anytime cards.
INSERT INTO public.ao_library_cards (code, title, what_text, why_text, how_text, required_output, documentation_note,
    est_hours_min, est_hours_max, lane, stage_window, team_needs_this, lock_rule, card_group, event_triggered,
    opens_text, deadline_text, deadline_calendar_days, cutoff_rule, takeover_text, output_fields, status, updated_by)
SELECT 'N15', l.title, l.what, l.why, l.how, l.ways_to_document,
       'Evidence to keep: ' || l.ways_to_document || ' Time: the homeowner enters actual minutes after doing the work; no estimated or prefilled time.',
       NULL, NULL, 'flexible', 'anytime', false, 'none', 'New project', false,
       'Open on day one', 'Target 7 calendar days', 7, 'none', 'The card closes. ARHA continues with its own material.',
       '[{"key": "notes", "type": "long_text", "label": "What you prepared"}, {"key": "links", "type": "text", "label": "Links to your sources"}]'::jsonb,
       'draft', '98bd6696-4018-4965-b645-0471c5ae3925'
  FROM public.owner_opportunity_library l
 WHERE l.title = $t$Create house notes for future guests$t$
   AND NOT EXISTS (SELECT 1 FROM public.ao_library_cards c WHERE c.code = 'N15');
INSERT INTO public.ao_library_card_history (card_id, version, snapshot, changed_by)
SELECT c.id, c.version, to_jsonb(c), '98bd6696-4018-4965-b645-0471c5ae3925' FROM public.ao_library_cards c
 WHERE c.code = 'N15' AND c.status = 'draft' AND c.version = 1
   AND NOT EXISTS (SELECT 1 FROM public.ao_library_card_history h WHERE h.card_id = c.id);
SELECT 'N15' AS card, public.ao_card_set_status(id, 'released') AS version
  FROM public.ao_library_cards WHERE code = 'N15' AND status = 'draft' AND version = 1;

INSERT INTO public.ao_library_cards (code, title, what_text, why_text, how_text, required_output, documentation_note,
    est_hours_min, est_hours_max, lane, stage_window, team_needs_this, lock_rule, card_group, event_triggered,
    opens_text, deadline_text, deadline_calendar_days, cutoff_rule, takeover_text, output_fields, status, updated_by)
SELECT 'N16', l.title, l.what, l.why, l.how, l.ways_to_document,
       'Evidence to keep: ' || l.ways_to_document || ' Time: the homeowner enters actual minutes after doing the work; no estimated or prefilled time.',
       NULL, NULL, 'flexible', 'anytime', false, 'none', 'New project', false,
       'Open on day one', 'Target 7 calendar days', 7, 'none', 'The card closes. ARHA continues with its own material.',
       '[{"key": "notes", "type": "long_text", "label": "What you prepared"}, {"key": "links", "type": "text", "label": "Links to your sources"}]'::jsonb,
       'draft', '98bd6696-4018-4965-b645-0471c5ae3925'
  FROM public.owner_opportunity_library l
 WHERE l.title = $t$Property & market education$t$
   AND NOT EXISTS (SELECT 1 FROM public.ao_library_cards c WHERE c.code = 'N16');
INSERT INTO public.ao_library_card_history (card_id, version, snapshot, changed_by)
SELECT c.id, c.version, to_jsonb(c), '98bd6696-4018-4965-b645-0471c5ae3925' FROM public.ao_library_cards c
 WHERE c.code = 'N16' AND c.status = 'draft' AND c.version = 1
   AND NOT EXISTS (SELECT 1 FROM public.ao_library_card_history h WHERE h.card_id = c.id);
SELECT 'N16' AS card, public.ao_card_set_status(id, 'released') AS version
  FROM public.ao_library_cards WHERE code = 'N16' AND status = 'draft' AND version = 1;

INSERT INTO public.ao_library_cards (code, title, what_text, why_text, how_text, required_output, documentation_note,
    est_hours_min, est_hours_max, lane, stage_window, team_needs_this, lock_rule, card_group, event_triggered,
    opens_text, deadline_text, deadline_calendar_days, cutoff_rule, takeover_text, output_fields, status, updated_by)
SELECT 'N17', l.title, l.what, l.why, l.how, l.ways_to_document,
       'Evidence to keep: ' || l.ways_to_document || ' Time: the homeowner enters actual minutes after doing the work; no estimated or prefilled time.',
       NULL, NULL, 'flexible', 'anytime', false, 'none', 'New project', false,
       'Open on day one', 'Target 7 calendar days', 7, 'none', 'The card closes. ARHA continues with its own material.',
       '[{"key": "notes", "type": "long_text", "label": "What you prepared"}, {"key": "links", "type": "text", "label": "Links to your sources"}]'::jsonb,
       'draft', '98bd6696-4018-4965-b645-0471c5ae3925'
  FROM public.owner_opportunity_library l
 WHERE l.title = $t$Research remote-work amenities$t$
   AND NOT EXISTS (SELECT 1 FROM public.ao_library_cards c WHERE c.code = 'N17');
INSERT INTO public.ao_library_card_history (card_id, version, snapshot, changed_by)
SELECT c.id, c.version, to_jsonb(c), '98bd6696-4018-4965-b645-0471c5ae3925' FROM public.ao_library_cards c
 WHERE c.code = 'N17' AND c.status = 'draft' AND c.version = 1
   AND NOT EXISTS (SELECT 1 FROM public.ao_library_card_history h WHERE h.card_id = c.id);
SELECT 'N17' AS card, public.ao_card_set_status(id, 'released') AS version
  FROM public.ao_library_cards WHERE code = 'N17' AND status = 'draft' AND version = 1;

-- 3. Once per owner, each with a version and a history row.
WITH marked AS (
  UPDATE public.ao_library_cards SET once_per_owner = true, version = version + 1, updated_by = '98bd6696-4018-4965-b645-0471c5ae3925', updated_at = now()
   WHERE code IN ('N05', 'N06', 'N07', 'N08', 'N12', 'P16', 'P17', 'P18') AND NOT once_per_owner
  RETURNING *
)
INSERT INTO public.ao_library_card_history (card_id, version, snapshot, changed_by)
SELECT m.id, m.version, to_jsonb(m), '98bd6696-4018-4965-b645-0471c5ae3925' FROM marked m;
