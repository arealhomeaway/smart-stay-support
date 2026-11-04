-- Notion ticket import support. PENDING: not applied. Approved by Emily (Nov 4, 2026).
-- Undo: 01_undo_notion_ticket_import.sql
--
-- What it adds:
--  1. tickets.import_hold: 'backlog_review' or 'needs_home' keeps an imported ticket
--     out of PC queues, My Work and Team Queue until someone moves it out. Null = normal.
--  2. ticket_activity.external_author_name / external_id: an imported Notion comment keeps
--     its original author as text, its original date in created_at/event_at, and its
--     Notion comment ID so reruns never duplicate it.
--  3. The (external_source, external_id) unique rule on tickets already exists live as
--     tickets_external_unique; this file asserts it instead of adding a second one.
--  4. Import-quiet triggers: the routing, alert, owner-notice, work item, opportunity and
--     audit triggers on tickets gain WHEN (resolve.import_quiet is not 'on'). Only the
--     import functions below set that flag, inside their own transaction, so every other
--     write behaves exactly as today. Bodies of the trigger functions are untouched.
--  5. Three Admin-only import functions (caller authenticated, no anon or PUBLIC execute).

ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS import_hold text;
ALTER TABLE public.tickets ADD CONSTRAINT tickets_import_hold_chk
  CHECK (import_hold IS NULL OR import_hold IN ('backlog_review','needs_home'));
COMMENT ON COLUMN public.tickets.import_hold IS
  'Imported ticket review list: backlog_review or needs_home. Held tickets stay out of PC queues, My Work and Team Queue.';

ALTER TABLE public.ticket_activity ADD COLUMN IF NOT EXISTS external_author_name text;
ALTER TABLE public.ticket_activity ADD COLUMN IF NOT EXISTS external_id text;
CREATE UNIQUE INDEX IF NOT EXISTS ticket_activity_external_once
  ON public.ticket_activity (ticket_id, external_id) WHERE external_id IS NOT NULL;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='tickets_external_unique') THEN
    CREATE UNIQUE INDEX tickets_external_unique ON public.tickets (external_source, external_id)
      WHERE external_source IS NOT NULL AND external_id IS NOT NULL;
  END IF;
END $$;

-- Import-quiet triggers (same events and functions as today, plus WHEN).
DROP TRIGGER tickets_auto_assign ON public.tickets;
CREATE TRIGGER tickets_auto_assign BEFORE INSERT ON public.tickets FOR EACH ROW
  WHEN (current_setting('resolve.import_quiet', true) IS DISTINCT FROM 'on') EXECUTE FUNCTION auto_assign_ticket();
DROP TRIGGER tickets_audit_auto_assign ON public.tickets;
CREATE TRIGGER tickets_audit_auto_assign AFTER INSERT ON public.tickets FOR EACH ROW
  WHEN (current_setting('resolve.import_quiet', true) IS DISTINCT FROM 'on') EXECUTE FUNCTION audit_ticket_auto_assign();
DROP TRIGGER tickets_priority_authority ON public.tickets;
CREATE TRIGGER tickets_priority_authority BEFORE INSERT OR UPDATE OF priority ON public.tickets FOR EACH ROW
  WHEN (current_setting('resolve.import_quiet', true) IS DISTINCT FROM 'on') EXECUTE FUNCTION enforce_ticket_priority_authority();
DROP TRIGGER notify_ticket_events_trg ON public.tickets;
CREATE TRIGGER notify_ticket_events_trg AFTER INSERT OR UPDATE ON public.tickets FOR EACH ROW
  WHEN (current_setting('resolve.import_quiet', true) IS DISTINCT FROM 'on') EXECUTE FUNCTION notify_ticket_events();
DROP TRIGGER notify_ticket_flow_events_trg ON public.tickets;
CREATE TRIGGER notify_ticket_flow_events_trg AFTER UPDATE ON public.tickets FOR EACH ROW
  WHEN (current_setting('resolve.import_quiet', true) IS DISTINCT FROM 'on') EXECUTE FUNCTION notify_ticket_flow_events();
DROP TRIGGER sync_ticket_work_item ON public.tickets;
CREATE TRIGGER sync_ticket_work_item AFTER INSERT OR UPDATE ON public.tickets FOR EACH ROW
  WHEN (current_setting('resolve.import_quiet', true) IS DISTINCT FROM 'on') EXECUTE FUNCTION sync_ticket_work_item();
DROP TRIGGER tickets_notify_owner ON public.tickets;
CREATE TRIGGER tickets_notify_owner AFTER INSERT OR UPDATE ON public.tickets FOR EACH ROW
  WHEN (current_setting('resolve.import_quiet', true) IS DISTINCT FROM 'on') EXECUTE FUNCTION notify_owner_of_ticket();
DROP TRIGGER tickets_owner_opportunity ON public.tickets;
CREATE TRIGGER tickets_owner_opportunity AFTER INSERT OR UPDATE ON public.tickets FOR EACH ROW
  WHEN (current_setting('resolve.import_quiet', true) IS DISTINCT FROM 'on') EXECUTE FUNCTION sync_ticket_opportunity_trigger();
DROP TRIGGER tickets_insurance_risk_log ON public.tickets;
CREATE TRIGGER tickets_insurance_risk_log AFTER INSERT OR UPDATE OF insurance_risk ON public.tickets FOR EACH ROW
  WHEN (current_setting('resolve.import_quiet', true) IS DISTINCT FROM 'on') EXECUTE FUNCTION log_ticket_insurance_risk();
DROP TRIGGER tickets_feedback_linked_work ON public.tickets;
CREATE TRIGGER tickets_feedback_linked_work AFTER INSERT ON public.tickets FOR EACH ROW
  WHEN (current_setting('resolve.import_quiet', true) IS DISTINCT FROM 'on') EXECUTE FUNCTION log_feedback_linked_work();
DROP TRIGGER tickets_roll_quarterly_review ON public.tickets;
CREATE TRIGGER tickets_roll_quarterly_review AFTER UPDATE ON public.tickets FOR EACH ROW
  WHEN (current_setting('resolve.import_quiet', true) IS DISTINCT FROM 'on') EXECUTE FUNCTION roll_quarterly_review();
DROP TRIGGER handoff_carryover_ticket_completed ON public.tickets;
CREATE TRIGGER handoff_carryover_ticket_completed AFTER UPDATE OF status ON public.tickets FOR EACH ROW
  WHEN (current_setting('resolve.import_quiet', true) IS DISTINCT FROM 'on') EXECUTE FUNCTION complete_handoff_carryover_tasks();
-- Kept as today (always run): tickets_audit, tickets_guest_impact_log, tickets_demo_property_consistency,
-- trg_ticket_selected_vendor_guard, tickets_updated.

-- Pass 1: one ticket plus its linked claim, upserted on the Notion page ID.
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

-- Pass 2a: comments as read-only history with original author text and date.
CREATE OR REPLACE FUNCTION public.import_notion_ticket_comments(p_ticket_id uuid, p_comments jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _n integer := 0; _c jsonb; _rows integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only an Admin can run the Notion import';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.tickets WHERE id = p_ticket_id AND external_source = 'notion') THEN
    RAISE EXCEPTION 'Not an imported Notion ticket';
  END IF;
  FOR _c IN SELECT * FROM jsonb_array_elements(coalesce(p_comments,'[]'::jsonb)) LOOP
    INSERT INTO public.ticket_activity (ticket_id, author_id, kind, event_type, body, internal, is_demo,
      created_at, event_at, external_author_name, external_id)
    VALUES (p_ticket_id, NULL, 'note', 'imported_comment', coalesce(_c->>'body',''), true, false,
      coalesce(nullif(_c->>'created_at','')::timestamptz, now()), nullif(_c->>'created_at','')::timestamptz,
      coalesce(nullif(_c->>'author',''), 'Unknown Notion user'), _c->>'external_id')
    ON CONFLICT (ticket_id, external_id) WHERE external_id IS NOT NULL DO NOTHING;
    GET DIAGNOSTICS _rows = ROW_COUNT; _n := _n + _rows;
  END LOOP;
  RETURN _n;
END $$;

-- Pass 2b: one copied file. The file is already in storage; this records it once.
CREATE OR REPLACE FUNCTION public.import_notion_ticket_file(p_ticket_id uuid, p jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _t public.tickets; _rows integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only an Admin can run the Notion import';
  END IF;
  SELECT * INTO _t FROM public.tickets WHERE id = p_ticket_id AND external_source = 'notion';
  IF NOT FOUND THEN RAISE EXCEPTION 'Not an imported Notion ticket'; END IF;
  IF coalesce(p->>'upload_key','') NOT LIKE 'notion:%' THEN RAISE EXCEPTION 'Bad file key'; END IF;
  INSERT INTO public.documents (entity_type, entity_id, property_id, kind, title, storage_path, original_filename,
    mime_type, size_bytes, upload_key, upload_status, uploaded_at, uploaded_by, visibility, category, note, is_demo)
  VALUES ('ticket', p_ticket_id, _t.property_id, coalesce(p->>'kind','file'), p->>'title', p->>'storage_path',
    p->>'original_filename', p->>'mime_type', nullif(p->>'size_bytes','')::bigint, p->>'upload_key', 'stored',
    now(), auth.uid(), 'internal', 'maintenance', 'Imported from Notion', false)
  ON CONFLICT (upload_key) WHERE upload_key IS NOT NULL DO NOTHING;
  GET DIAGNOSTICS _rows = ROW_COUNT;
  RETURN _rows > 0;
END $$;

REVOKE ALL ON FUNCTION public.import_notion_ticket(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.import_notion_ticket_comments(uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.import_notion_ticket_file(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.import_notion_ticket(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.import_notion_ticket_comments(uuid, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.import_notion_ticket_file(uuid, jsonb) TO authenticated, service_role;