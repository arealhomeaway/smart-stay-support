-- Undo for docs/pending/owner-record-merge/apply.sql. Restores each merged pair exactly from its audit row:
-- the kept record's original id format, the retired record (active, original id and notes), and the homes
-- and documents that were moved. History rows were never changed. Writes one audit row.
DROP INDEX IF EXISTS public.property_owners_one_per_ownerrez_owner;
DO $undo$
DECLARE a record; n integer := 0;
BEGIN
  FOR a IN SELECT * FROM public.audit_log WHERE action = 'owner_record_merged' ORDER BY created_at LOOP
    UPDATE public.property_owners SET source_owner_id = a.before_value->>'kept_source_owner_id' WHERE id = (a.before_value->>'kept_id')::uuid;
    UPDATE public.property_owners
       SET active = (a.before_value->>'retired_active')::boolean,
           source_owner_id = a.before_value->>'retired_source_owner_id',
           notes = a.before_value->>'retired_notes'
     WHERE id = (a.before_value->>'retired_id')::uuid;
    UPDATE public.properties SET owner_record_id = (a.before_value->>'retired_id')::uuid
     WHERE id IN (SELECT jsonb_array_elements_text(a.after_value->'moved_property_ids')::uuid);
    UPDATE public.documents SET owner_recipient_id = (a.before_value->>'retired_id')::uuid
     WHERE id IN (SELECT jsonb_array_elements_text(a.after_value->'moved_document_ids')::uuid);
    n := n + 1;
  END LOOP;
  INSERT INTO public.audit_log(actor_id, actor_label, action, entity_type, entity_label, reason, after_value)
  VALUES ('98bd6696-4018-4965-b645-0471c5ae3925', 'Admin', 'owner_record_merge_undone', 'property_owner', 'Owner record merge',
    'Undo of docs/pending/owner-record-merge/apply.sql.', jsonb_build_object('pairs_restored', n));
END $undo$;
