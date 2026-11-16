-- Owner record merge (Admin approved, Nov 16, 2026; live, no staging).
-- The OwnerRez sync stored the same OwnerRez owner two ways ("ownerrez:<id>" and "<id>") and made
-- a second owner record each time. Three pairs exist. For each pair this keeps the record that
-- programs, homes or documents already use, points every home or document that used the other one
-- at it, and retires the other one (inactive, its key renamed so no sync can match or revive it).
-- Owner program links and recipient history are immutable: if a retired record is used there,
-- nothing is applied. Then the kept records use the bare OwnerRez id only, and a unique index
-- allows one record per OwnerRez owner in either format. One audit row per merge.
-- Undo: docs/pending/owner-record-merge/apply.undo.sql.
DO $merge$
DECLARE
  pair record; k public.property_owners; r public.property_owners;
  moved_homes uuid[]; moved_docs uuid[]; n integer;
BEGIN
  FOR pair IN
    SELECT * FROM (VALUES
      ('Nancy DeLeon', '2ec04185-6b03-4204-8680-b3e8897b23d5'::uuid, '7ee766c6-05a7-48b9-9fcd-20b2f588cb8c'::uuid, '150925118'),
      ('Rachel Ramsey', '056a57f2-959f-41f8-8ff5-4eac7c0bac9b'::uuid, '41497378-4717-4d44-bde3-b6f559fcf72a'::uuid, '150924525'),
      ('Adriel Properties, LLC', '55757b31-7995-4725-a2d7-429af790a87b'::uuid, 'a9372065-2230-40d4-aa6e-8221b8e07cb3'::uuid, '150923799')
    ) AS v(label, keep_id, retire_id, ownerrez_id)
  LOOP
    SELECT * INTO k FROM public.property_owners WHERE id = pair.keep_id FOR UPDATE;
    SELECT * INTO r FROM public.property_owners WHERE id = pair.retire_id FOR UPDATE;
    -- Preflight: both records exist, are OwnerRez records for the same owner, and the retired one is still active.
    IF k.id IS NULL OR r.id IS NULL THEN RAISE EXCEPTION 'Preflight: % pair is missing a record.', pair.label; END IF;
    IF k.source <> 'ownerrez' OR r.source <> 'ownerrez'
       OR regexp_replace(k.source_owner_id, '^ownerrez:', '') <> pair.ownerrez_id
       OR regexp_replace(r.source_owner_id, '^ownerrez:', '') <> pair.ownerrez_id
       OR k.source_owner_id = r.source_owner_id OR NOT r.active THEN
      RAISE EXCEPTION 'Preflight: % pair is not as reviewed (keep %, retire %).', pair.label, k.source_owner_id, r.source_owner_id;
    END IF;
    -- The retired record must not be used by anything that cannot be repointed.
    SELECT (SELECT count(*) FROM public.owner_programs WHERE owner_record_id = r.id)
         + (SELECT count(*) FROM public.document_recipient_events WHERE owner_id = r.id)
         + (SELECT count(*) FROM public.owner_approval_publications WHERE owner_record_id = r.id)
         + (SELECT count(*) FROM public.owner_invite_redemptions WHERE owner_record_id = r.id)
         + (SELECT count(*) FROM public.ticket_owner_updates WHERE owner_record_id = r.id)
         + (SELECT count(*) FROM public.property_owner_team_note_events WHERE owner_id = r.id) INTO n;
    IF n > 0 THEN RAISE EXCEPTION 'Preflight: % record to retire is used by a program or by history (% rows). Nothing applied.', pair.label, n; END IF;

    -- Point homes and documents at the kept record.
    WITH m AS (UPDATE public.properties SET owner_record_id = k.id WHERE owner_record_id = r.id RETURNING id)
      SELECT coalesce(array_agg(id), '{}') INTO moved_homes FROM m;
    WITH m AS (UPDATE public.documents SET owner_recipient_id = k.id WHERE owner_recipient_id = r.id RETURNING id)
      SELECT coalesce(array_agg(id), '{}') INTO moved_docs FROM m;

    -- Retire: kept for history, never matched or revived by a sync.
    UPDATE public.property_owners
       SET active = false, source_owner_id = 'merged:' || r.source_owner_id,
           notes = 'Duplicate owner record. Merged Nov 16, 2026.'
     WHERE id = r.id;
    -- The kept record uses the one format: the bare OwnerRez id.
    UPDATE public.property_owners SET source_owner_id = pair.ownerrez_id WHERE id = k.id AND source_owner_id <> pair.ownerrez_id;

    INSERT INTO public.audit_log(actor_id, actor_label, action, entity_type, entity_id, entity_label, reason, before_value, after_value)
    VALUES ('98bd6696-4018-4965-b645-0471c5ae3925', 'Admin', 'owner_record_merged', 'property_owner', k.id, pair.label,
      'Approved by the Admin, Nov 16: the OwnerRez sync made a second owner record for the same OwnerRez owner. '
      || 'Kept the record already in use, pointed its other homes and documents at it, retired the duplicate. '
      || 'Undo: docs/pending/owner-record-merge/apply.undo.sql.',
      jsonb_build_object('kept_id', k.id, 'kept_source_owner_id', k.source_owner_id,
        'retired_id', r.id, 'retired_source_owner_id', r.source_owner_id, 'retired_active', r.active, 'retired_notes', r.notes),
      jsonb_build_object('kept_source_owner_id', pair.ownerrez_id, 'retired_source_owner_id', 'merged:' || r.source_owner_id,
        'retired_active', false, 'moved_property_ids', to_jsonb(moved_homes), 'moved_document_ids', to_jsonb(moved_docs)));
  END LOOP;

  -- No other record may still carry the prefix.
  IF EXISTS (SELECT 1 FROM public.property_owners WHERE source = 'ownerrez' AND source_owner_id LIKE 'ownerrez:%') THEN
    RAISE EXCEPTION 'Another owner record still uses the old id format. Nothing applied.';
  END IF;
END $merge$;

-- One record per OwnerRez owner, whichever format a caller sends.
CREATE UNIQUE INDEX property_owners_one_per_ownerrez_owner
  ON public.property_owners ((regexp_replace(source_owner_id, '^ownerrez:', '')))
  WHERE source = 'ownerrez';
