-- Read only. Expect: homeowner_updates absent; the three new actions absent;
-- ao_edit_card_answer md5 2b3672794e95c6f7a60b91a6bffa3926 (needs a saved answer);
-- Shannon Linder's program: 36 entries, all hers and current.
SELECT to_regclass('public.homeowner_updates') AS updates_table,
  to_regprocedure('public.owner_update_time_entry(uuid,jsonb)') AS hours_action,
  to_regprocedure('public.owner_add_to_opportunity(uuid,text)') AS opportunity_action,
  to_regprocedure('public.owner_item_add(uuid,text)') AS item_action,
  md5(pg_get_functiondef('public.ao_edit_card_answer(uuid,jsonb,jsonb)'::regprocedure)) AS card_edit_md5,
  (SELECT count(*) FROM public.owner_time_entries WHERE program_id = '579cb6ae-c5a5-4aa3-aac2-64eedd2faafe') AS shannon_entries,
  (SELECT count(*) FROM public.owner_time_entries e WHERE program_id = '579cb6ae-c5a5-4aa3-aac2-64eedd2faafe'
     AND owner_user_id = (SELECT owner_user_id FROM public.owner_programs WHERE id = '579cb6ae-c5a5-4aa3-aac2-64eedd2faafe')
     AND NOT EXISTS (SELECT 1 FROM public.owner_time_entries a WHERE a.amends_entry_id = e.id)) AS shannon_current_own;
