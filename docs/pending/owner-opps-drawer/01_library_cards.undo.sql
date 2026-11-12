-- Undo for staged file 01 (run after 02 undo). Nothing is deleted: history stays add only.
SELECT set_config('request.jwt.claims', json_build_object('sub','98bd6696-4018-4965-b645-0471c5ae3925','role','authenticated')::text, true);
SELECT set_config('request.jwt.claim.sub', '98bd6696-4018-4965-b645-0471c5ae3925', true);

-- 3. Once per owner off again, each with a version and a history row.
WITH unmarked AS (
  UPDATE public.ao_library_cards SET once_per_owner = false, version = version + 1, updated_by = '98bd6696-4018-4965-b645-0471c5ae3925', updated_at = now()
   WHERE code IN ('N05', 'N06', 'N07', 'N08', 'N12', 'P16', 'P17', 'P18') AND once_per_owner
  RETURNING *
)
INSERT INTO public.ao_library_card_history (card_id, version, snapshot, changed_by)
SELECT m.id, m.version, to_jsonb(m), '98bd6696-4018-4965-b645-0471c5ae3925' FROM unmarked m;

-- 2. The three added cards are retired (kept with their history, never deleted).
SELECT code, public.ao_card_set_status(id, 'retired') AS version
  FROM public.ao_library_cards WHERE code IN ('N15', 'N16', 'N17') AND status <> 'retired';

-- 1. The five Optional Library cards return, from 01's receipts only.
WITH restored AS (
  UPDATE public.owner_opportunity_library l SET active = true, updated_at = now()
   WHERE NOT l.active
     AND l.id IN (SELECT a.entity_id FROM public.audit_log a WHERE a.action = 'owner_library_retired' AND a.entity_type = 'owner_opportunity_library')
  RETURNING id, title
)
INSERT INTO public.audit_log (actor_id, action, entity_type, entity_id, entity_label, reason, before_value, after_value)
SELECT '98bd6696-4018-4965-b645-0471c5ae3925', 'owner_library_restored', 'owner_opportunity_library', id, title,
       'Undo of staged file 01', jsonb_build_object('active', false), jsonb_build_object('active', true)
  FROM restored;

-- The once_per_owner column stays (additive, all false, unused after 02 undo).
COMMENT ON COLUMN public.ao_library_cards.once_per_owner IS 'DEPRECATED: unused after the 01 undo; every value is false.';
