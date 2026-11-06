-- UNDO for 03_release_new_cards.sql
DO $do$ DECLARE r public.ao_library_cards; BEGIN
  FOR r IN UPDATE public.ao_library_cards SET status = 'draft', version = version + 1, updated_by = '98bd6696-4018-4965-b645-0471c5ae3925', updated_at = now()
           WHERE code IN ('A58','A59') AND status = 'released' RETURNING * LOOP
    INSERT INTO public.ao_library_card_history(card_id, version, snapshot, changed_by) VALUES (r.id, r.version, to_jsonb(r), '98bd6696-4018-4965-b645-0471c5ae3925');
  END LOOP;
END $do$;
