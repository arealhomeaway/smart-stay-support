-- shannon-badge-refresh: preflight (read only). Every row must say ok = true before apply.
WITH c AS (SELECT e.* FROM public.owner_time_entries e WHERE e.program_id = '579cb6ae-c5a5-4aa3-aac2-64eedd2faafe'
  AND NOT EXISTS (SELECT 1 FROM public.owner_time_entries a WHERE a.amends_entry_id = e.id))
SELECT 'Shannon counts 33 entries, 2,523 minutes' AS check, (SELECT count(*) = 33 AND sum(minutes) = 2523 FROM c) AS ok
UNION ALL SELECT 'all 65 entries kept', (SELECT count(*) = 65 FROM public.owner_time_entries WHERE program_id = '579cb6ae-c5a5-4aa3-aac2-64eedd2faafe')
UNION ALL SELECT 'the seven badges, none flagged yet',
  (SELECT string_agg(code || ':' || needs_review::text, ',' ORDER BY code) FROM public.owner_badges WHERE program_id = '579cb6ae-c5a5-4aa3-aac2-64eedd2faafe')
  = 'building_momentum:false,consistent_participation:false,engaged_owner:false,first_step:false,halfway:false,on_track_owner:false,strong_finish:false'
UNION ALL SELECT 'the badge refresh is unchanged (md5 of body)',
  (SELECT md5(prosrc) FROM pg_proc WHERE oid = 'public.refresh_owner_badges(uuid,uuid,uuid)'::regprocedure) = 'ddc85278f325650af7de5a3c90072557'
UNION ALL SELECT 'the program is active',
  (SELECT status = 'active' AND archived_at IS NULL FROM public.owner_programs WHERE id = '579cb6ae-c5a5-4aa3-aac2-64eedd2faafe');
