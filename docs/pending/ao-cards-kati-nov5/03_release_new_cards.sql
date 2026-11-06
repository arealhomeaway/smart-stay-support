-- STAGED, NOT APPLIED. Approved by Emily Nov 6 (Kati's Active Owner review). Run only with explicit approval to apply.
-- No BEGIN/COMMIT: the migration tool runs the file in one transaction.
-- Separate approval: release the two new cards (mirrors ao_card_set_status). Released cards join a home's plan only when staff
-- set up or refresh that home's Active Owner plan; homes already joined keep their plans until then.
DO $do$ DECLARE r public.ao_library_cards; BEGIN
  FOR r IN UPDATE public.ao_library_cards SET status = 'released', retired_at = NULL, version = version + 1, updated_by = '98bd6696-4018-4965-b645-0471c5ae3925', updated_at = now()
           WHERE code IN ('A58','A59') AND status = 'draft' RETURNING * LOOP
    INSERT INTO public.ao_library_card_history(card_id, version, snapshot, changed_by) VALUES (r.id, r.version, to_jsonb(r), '98bd6696-4018-4965-b645-0471c5ae3925');
  END LOOP;
  IF (SELECT count(*) FROM public.ao_library_cards WHERE code IN ('A58','A59') AND status = 'released') <> 2 THEN RAISE EXCEPTION 'A58/A59 not both released; nothing applied'; END IF;
END $do$;
