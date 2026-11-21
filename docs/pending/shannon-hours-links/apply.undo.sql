-- Undo for shannon-hours-links: clears the 32 links and reasons this package set. Nothing is deleted.
DO $undo$
DECLARE prog uuid := '579cb6ae-c5a5-4aa3-aac2-64eedd2faafe'; n bigint;
BEGIN
  DROP TABLE IF EXISTS _links;
  CREATE TEMP TABLE _links (n int, newer uuid, older uuid) ON COMMIT DROP;
  INSERT INTO _links VALUES
    (1, '6d3af74c-b02c-4971-8503-431361f1da48'::uuid, '49c61290-509b-453b-ade2-d1d5f0d44083'::uuid),
    (2, 'b074d2e5-c4a2-4678-bfee-3a5e49210805'::uuid, '960777a3-d864-491d-b97a-172bde07271d'::uuid),
    (3, '5a59278c-24bb-4c3f-a3fb-8d852a3afafc'::uuid, 'a7ac1b6e-68e8-4598-87c2-096640ca7e75'::uuid),
    (4, 'cd39bd91-c9a1-4db3-9307-787f9df404a1'::uuid, '02a23ad1-5ba5-4311-8eb5-25a4be41e30a'::uuid),
    (5, '479affe0-e397-4075-bdb4-5f7608ae4e5b'::uuid, '26f00e96-eb6a-4d02-a299-ac327a0daef7'::uuid),
    (6, '0560cd5f-80fe-4969-942a-7c414fd2bd34'::uuid, '23ef3a09-35c6-47db-ab72-9a372c4766a4'::uuid),
    (7, '39cf8bf9-b5e3-4570-9dc3-4aaa5f8bd410'::uuid, '0560cd5f-80fe-4969-942a-7c414fd2bd34'::uuid),
    (8, '4456f54d-696b-44dd-88b8-4222f209e8ee'::uuid, '39cf8bf9-b5e3-4570-9dc3-4aaa5f8bd410'::uuid),
    (9, '666b3f10-aa2e-4c52-9156-12d13b17d0ff'::uuid, '4456f54d-696b-44dd-88b8-4222f209e8ee'::uuid),
    (10, 'b23cc54e-e364-4149-8559-11b8dd98aa00'::uuid, '30151085-2ba7-47a7-a6fd-8554324cb5fe'::uuid),
    (11, 'b692fe7f-8ffb-4836-bbf5-ebb26319ce47'::uuid, 'df948c9a-ee50-4256-8f49-b419bacfa6dc'::uuid),
    (12, 'e97574ec-54a0-4482-9410-de0e4caba4e2'::uuid, '31973a87-910f-48f1-bf55-72c20d81871f'::uuid),
    (13, 'e22e7cf5-e13b-411b-80fa-898990edfa6f'::uuid, '3f0952a1-955e-4492-b8fb-2183d7601c0a'::uuid),
    (14, 'd43d2492-89ec-4657-83ef-31c482d19dc0'::uuid, 'e9905865-ad84-4596-a4f1-2c8569abe85f'::uuid),
    (15, '2ce41c3d-d53c-49aa-b333-7b9bb73f2e63'::uuid, '319f69e9-d746-482e-8376-1798b1497c7c'::uuid),
    (16, '869fa37f-47ec-4c7f-a8c8-cb645dbfbd56'::uuid, '517d08fc-aa00-4c6c-a1af-645e33aa6f36'::uuid),
    (17, 'ce963b43-1e0f-499b-8361-a3ae74f4ff1f'::uuid, 'a271e62b-a480-43d2-ba2c-288f6e1f801b'::uuid),
    (18, '7ba6cc58-3510-46f9-ba85-bafbeb563dd9'::uuid, '2ac37fc7-838f-4359-b013-8e78d248958c'::uuid),
    (19, 'f2ac4a6e-1ac7-4fff-b4a7-728cff55a51c'::uuid, 'a2a701b2-6538-41c0-a7fc-485a09d29c78'::uuid),
    (20, 'd51f6651-9c60-4429-892c-70932b658890'::uuid, '6136f460-b3e0-41c8-8983-0689dd438328'::uuid),
    (21, '9ac51f0a-1024-4938-842c-543662c8d45f'::uuid, 'bc757fd0-975c-43db-b5e8-617252b73973'::uuid),
    (22, 'ed233409-f90d-46ea-b5ec-332195abce09'::uuid, '293f8a82-e64c-4a0f-b806-a05d90139e2b'::uuid),
    (23, '4f934c5f-b47c-4e13-b73e-d626277d471f'::uuid, 'ed233409-f90d-46ea-b5ec-332195abce09'::uuid),
    (24, '1e06ff84-37b8-4fa0-9146-abe885e07a98'::uuid, '77acd8d7-a9ac-4d1a-a37b-af72408c4d9d'::uuid),
    (25, '901262a2-255d-46e9-8ca5-db83eac30740'::uuid, '75d9bdc2-aa72-46b1-afdd-54b8a0862251'::uuid),
    (26, '7df8a556-6a4e-487c-9016-c2882d635149'::uuid, 'c6e99bbd-9f97-4e92-9c24-a1439ca94a42'::uuid),
    (27, 'bd25b689-e662-4698-a540-6ca7813f90ef'::uuid, 'b5d34b7c-aa36-4bc2-a798-6582027325a2'::uuid),
    (28, '7bb4118a-e993-4c9a-8ccd-32b689d37983'::uuid, '5c46738f-664a-4847-b7a6-1a7a13439d14'::uuid),
    (29, '354f851c-f590-4bd5-b6ed-50431c1b2566'::uuid, 'f508978e-ba63-45a0-bd04-6ffcd95928dd'::uuid),
    (30, '033e91fc-b0f8-473e-8c6c-d20de2e6561f'::uuid, '8c32b5f1-a9ca-41ff-bc70-5630e2972aeb'::uuid),
    (31, '9fa64ccd-0b9f-4825-989d-b9cd70c0ce67'::uuid, 'c118620c-c402-4bec-96c3-2ba4a4ae3f63'::uuid),
    (32, '0d69f28c-7540-468c-8e2f-edb75178e7c1'::uuid, 'dd17656c-8ec9-43c3-91d4-28578a45070f'::uuid);
  SELECT count(*) INTO n FROM public.owner_time_entries e JOIN _links l ON l.newer = e.id
   WHERE e.program_id = prog AND e.amends_entry_id = l.older
     AND e.correction_reason = 'Homeowner logged this again with an update; replaces the earlier entry.';
  IF n <> 32 THEN RAISE EXCEPTION 'STOP: % of 32 links found as this package set them', n; END IF;
  EXECUTE 'ALTER TABLE public.owner_time_entries DISABLE TRIGGER owner_time_write_guard';
  UPDATE public.owner_time_entries e SET amends_entry_id = NULL, correction_reason = NULL
    FROM _links l WHERE e.id = l.newer AND e.program_id = prog AND e.amends_entry_id = l.older;
  GET DIAGNOSTICS n = ROW_COUNT;
  EXECUTE 'ALTER TABLE public.owner_time_entries ENABLE TRIGGER owner_time_write_guard';
  IF n <> 32 THEN RAISE EXCEPTION 'STOP: % rows cleared, expected 32', n; END IF;
  INSERT INTO public.audit_log(actor_id, actor_label, action, entity_type, entity_label, reason)
  VALUES ('98bd6696-4018-4965-b645-0471c5ae3925', 'Admin', 'owner_time_entry.link_repeat.undo', 'owner_program',
          'Shannon Linder hours, 1399 Foxtail Ln', 'Undo of shannon-hours-links: 32 links cleared; all 65 entries count again.');
END $undo$;
