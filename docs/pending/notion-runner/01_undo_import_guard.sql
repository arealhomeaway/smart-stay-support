-- Undo for 01_import_guard.sql. Restores public.import_notion_ticket exactly as it
-- is live today (Nov 8, 2026) and gives service_role execute back.
-- No BEGIN/COMMIT: the migration tool runs this file in one transaction.

CREATE OR REPLACE FUNCTION public.import_notion_ticket(p jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _ext text := nullif(btrim(p->>'external_id'), '');
  _synced timestamptz := nullif(p->>'external_synced_at','')::timestamptz;
  _t public.tickets;
  _id uuid;
  _action text;
  _claim jsonb := p->'claim';
  _claim_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only an Admin can run the Notion import';
  END IF;
  IF _ext IS NULL THEN RAISE EXCEPTION 'Missing Notion page ID'; END IF;
  IF coalesce(p->>'priority','') NOT IN ('p1','p2','p3') THEN RAISE EXCEPTION 'Bad priority'; END IF;
  IF coalesce(p->>'status','') NOT IN ('in_progress','closed') THEN RAISE EXCEPTION 'Bad status'; END IF;
  IF p->>'import_hold' IS NOT NULL AND p->>'import_hold' NOT IN ('backlog_review','needs_home') THEN
    RAISE EXCEPTION 'Bad import list';
  END IF;
  PERFORM set_config('resolve.import_quiet', 'on', true);
  PERFORM set_config('resolve.claim_sync', 'on', true);

  SELECT * INTO _t FROM public.tickets WHERE external_source = 'notion' AND external_id = _ext FOR UPDATE;
  IF FOUND AND _t.external_synced_at IS NOT DISTINCT FROM _synced THEN
    RETURN jsonb_build_object('action','skipped','ticket_id',_t.id,'ref',_t.ref);
  END IF;

  IF NOT FOUND THEN
    INSERT INTO public.tickets (
      title, description, category, entry_kind, priority, status, property_id, assigned_to,
      reported_at, due_at, resolved_at, breezeway_task_url, waiting_on, waiting_reason,
      source_channel, source_reference, external_source, external_id, external_status, external_url,
      external_synced_at, import_hold, is_demo, escalation_level, assignment_source, assignment_note
    ) VALUES (
      p->>'title', p->>'description', 'other', 'maintenance', p->>'priority', p->>'status',
      nullif(p->>'property_id','')::uuid, nullif(p->>'assigned_to','')::uuid,
      coalesce(nullif(p->>'reported_at','')::timestamptz, now()), nullif(p->>'due_at','')::timestamptz,
      nullif(p->>'resolved_at','')::timestamptz, nullif(p->>'breezeway_task_url',''),
      nullif(p->>'waiting_on',''), nullif(p->>'waiting_reason',''),
      'internal', 'Imported from Notion', 'notion', _ext, p->>'external_status', p->>'external_url',
      _synced, nullif(p->>'import_hold',''), false, 'none',
      CASE WHEN nullif(p->>'assigned_to','') IS NULL THEN NULL ELSE 'import' END,
      nullif(p->>'assignment_note','')
    ) RETURNING id INTO _id;
    _action := 'created';
  ELSE
    -- Notion-owned fields refresh. Resolve-side assignment, home and list choices are kept once set.
    UPDATE public.tickets SET
      title = p->>'title', description = p->>'description', priority = p->>'priority', status = p->>'status',
      due_at = nullif(p->>'due_at','')::timestamptz, resolved_at = nullif(p->>'resolved_at','')::timestamptz,
      breezeway_task_url = nullif(p->>'breezeway_task_url',''),
      waiting_on = nullif(p->>'waiting_on',''), waiting_reason = nullif(p->>'waiting_reason',''),
      external_status = p->>'external_status', external_url = p->>'external_url', external_synced_at = _synced,
      property_id = coalesce(property_id, nullif(p->>'property_id','')::uuid),
      assigned_to = coalesce(assigned_to, nullif(p->>'assigned_to','')::uuid)
    WHERE id = _t.id;
    _id := _t.id;
    _action := 'updated';
  END IF;

  IF _claim IS NOT NULL AND jsonb_typeof(_claim) = 'object' THEN
    SELECT id INTO _claim_id FROM public.claims WHERE ticket_id = _id;
    IF _claim_id IS NULL THEN
      INSERT INTO public.claims (claim_type, stage, title, incident_description, property_id, ticket_id,
        estimated_amount, recovered_amount, currency, created_by, is_demo)
      VALUES ('guest_damage', coalesce(_claim->>'stage','potential'), coalesce(p->>'title','Imported claim'),
        _claim->>'notes', nullif(p->>'property_id','')::uuid, _id,
        nullif(_claim->>'estimated_amount','')::numeric, nullif(_claim->>'recovered_amount','')::numeric,
        'USD', auth.uid(), false);
    ELSE
      UPDATE public.claims SET incident_description = _claim->>'notes',
        estimated_amount = nullif(_claim->>'estimated_amount','')::numeric,
        recovered_amount = nullif(_claim->>'recovered_amount','')::numeric
      WHERE id = _claim_id;
    END IF;
  END IF;

  RETURN jsonb_build_object('action',_action,'ticket_id',_id,'ref',(SELECT ref FROM public.tickets WHERE id=_id));
END $$;

GRANT EXECUTE ON FUNCTION public.import_notion_ticket(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.import_notion_ticket_comments(uuid, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.import_notion_ticket_file(uuid, jsonb) TO authenticated, service_role;
