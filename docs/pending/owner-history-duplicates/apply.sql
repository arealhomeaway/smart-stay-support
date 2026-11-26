ALTER TABLE public.owner_time_entries
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by uuid,
  ADD COLUMN IF NOT EXISTS archive_reason text;

COMMENT ON COLUMN public.owner_time_entries.archived_at IS 'Set when an active homeowner archives a later duplicate; the row and audit history are retained.';
COMMENT ON COLUMN public.owner_time_entries.archived_by IS 'Homeowner who archived this duplicate.';
COMMENT ON COLUMN public.owner_time_entries.archive_reason IS 'Reason recorded for this owner-only archive action.';

CREATE OR REPLACE FUNCTION public.archive_owner_duplicate_time_entry(_entry_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  uid uuid:=auth.uid();
  scope uuid;
  program public.owner_programs;
  target public.owner_time_entries;
  original_id uuid;
  stamp timestamptz:=now();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Sign in to remove a duplicate.'; END IF;
  SELECT program_id INTO scope FROM public.owner_time_entries WHERE id=_entry_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'That entry is not available. Refresh and try again.'; END IF;

  -- The existing owner lock admits active program members only, including the demo-owner gate.
  program:=private.lock_owner_time_program(scope,uid,false,false);
  PERFORM pg_advisory_xact_lock(hashtextextended('owner-time-duplicate:'||scope::text,0));
  SELECT * INTO target FROM public.owner_time_entries WHERE id=_entry_id FOR UPDATE NOWAIT;
  IF NOT FOUND OR target.program_id IS DISTINCT FROM program.id OR target.is_demo IS DISTINCT FROM program.is_demo
    OR target.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'That entry is not available. Refresh and try again.';
  END IF;

  -- The first current matching entry is the original and can never be archived by this action.
  SELECT e.id INTO original_id
  FROM public.owner_time_entries e
  WHERE e.program_id=target.program_id
    AND e.archived_at IS NULL
    AND e.entry_date=target.entry_date
    AND e.minutes=target.minutes
    AND e.activity=target.activity
    AND NOT EXISTS(SELECT 1 FROM public.owner_time_entries n WHERE n.amends_entry_id=e.id AND n.archived_at IS NULL)
  ORDER BY e.created_at,e.id
  LIMIT 1;
  IF original_id IS NULL OR original_id=target.id THEN
    RAISE EXCEPTION 'Keep the first entry. Choose a later duplicate instead.';
  END IF;

  UPDATE public.owner_time_entries
  SET archived_at=stamp,archived_by=uid,archive_reason='Duplicate removed from My history'
  WHERE id=target.id;

  INSERT INTO public.audit_log(actor_id,actor_label,action,entity_type,entity_id,entity_label,reason,before_value,after_value)
  VALUES(uid,'Homeowner','owner_time_duplicate_archived','owner_time_entry',target.id,left(target.activity,200),
    'Owner removed a later duplicate from My history',
    jsonb_build_object('entryDate',target.entry_date,'minutes',target.minutes,'activity',target.activity,'ownerUserId',target.owner_user_id,'createdAt',target.created_at),
    jsonb_build_object('archivedAt',stamp,'archivedBy',uid,'originalEntryId',original_id));

  RETURN jsonb_build_object('archivedEntryId',target.id,'originalEntryId',original_id);
EXCEPTION WHEN lock_not_available THEN
  RAISE EXCEPTION 'This entry is being updated. Refresh and try again.';
END $$;
REVOKE ALL ON FUNCTION public.archive_owner_duplicate_time_entry(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.archive_owner_duplicate_time_entry(uuid) TO authenticated,service_role;

DO $patch$
DECLARE def text;
BEGIN
  SELECT pg_get_functiondef('public.read_owner_work_history(uuid)'::regprocedure) INTO def;
  IF strpos(def,$old$WHERE e.program_id=_program AND e.is_demo=p.is_demo$old$)=0 THEN RAISE EXCEPTION 'History reader did not match its reviewed source'; END IF;
  def:=replace(def,$old$WHERE e.program_id=_program AND e.is_demo=p.is_demo$old$,$new$WHERE e.program_id=_program AND e.is_demo=p.is_demo AND e.archived_at IS NULL$new$);
  def:=replace(def,$old$EXISTS(SELECT 1 FROM public.owner_time_entries x WHERE x.amends_entry_id=e.id)$old$,$new$EXISTS(SELECT 1 FROM public.owner_time_entries x WHERE x.amends_entry_id=e.id AND x.archived_at IS NULL)$new$);
  EXECUTE def;

  SELECT pg_get_functiondef('public.read_owner_participation(text,uuid,boolean,uuid)'::regprocedure) INTO def;
  IF strpos(def,$old$AND private.owner_program_readable(auth.uid(),p.id,_preview) AND e.is_demo=p.is_demo$old$)=0 THEN RAISE EXCEPTION 'Participation reader did not match its reviewed source'; END IF;
  def:=replace(def,$old$AND private.owner_program_readable(auth.uid(),p.id,_preview) AND e.is_demo=p.is_demo$old$,$new$AND e.archived_at IS NULL AND private.owner_program_readable(auth.uid(),p.id,_preview) AND e.is_demo=p.is_demo$new$);
  EXECUTE def;

  SELECT pg_get_functiondef('private.owner_time_recent_repeat(uuid,uuid,date,integer,text,text,uuid)'::regprocedure) INTO def;
  IF strpos(def,$old$AND d.created_at > now() - interval '10 minutes'$old$)=0 THEN RAISE EXCEPTION 'Repeat rule did not match its reviewed source'; END IF;
  def:=replace(def,$old$AND d.created_at > now() - interval '10 minutes'$old$,$new$AND d.archived_at IS NULL AND d.created_at > now() - interval '10 minutes'$new$);
  EXECUTE def;

  SELECT pg_get_functiondef('public.owner_update_time_entry(uuid,jsonb)'::regprocedure) INTO def;
  IF strpos(def,$old$IF EXISTS (SELECT 1 FROM public.owner_time_entries WHERE amends_entry_id = original.id) THEN$old$)=0 THEN RAISE EXCEPTION 'Entry edit rule did not match its reviewed source'; END IF;
  def:=replace(def,$old$IF EXISTS (SELECT 1 FROM public.owner_time_entries WHERE amends_entry_id = original.id) THEN$old$,$new$IF EXISTS (SELECT 1 FROM public.owner_time_entries WHERE amends_entry_id = original.id AND archived_at IS NULL) THEN$new$);
  EXECUTE def;

  SELECT pg_get_functiondef('public.refresh_owner_badges(uuid,uuid,uuid)'::regprocedure) INTO def;
  IF strpos(def,$old$FROM owner_time_entries e WHERE e.program_id=p.id AND e.owner_user_id=p.owner_user_id AND e.is_demo=p.is_demo$old$)=0 THEN RAISE EXCEPTION 'Badge reader did not match its reviewed source'; END IF;
  def:=replace(def,$old$FROM owner_time_entries e WHERE e.program_id=p.id AND e.owner_user_id=p.owner_user_id AND e.is_demo=p.is_demo$old$,$new$FROM owner_time_entries e WHERE e.program_id=p.id AND e.owner_user_id=p.owner_user_id AND e.is_demo=p.is_demo AND e.archived_at IS NULL$new$);
  def:=replace(def,$old$correction.amends_entry_id=e.id)$old$,$new$correction.amends_entry_id=e.id AND correction.archived_at IS NULL)$new$);
  EXECUTE def;

  SELECT pg_get_functiondef('private.str_report_build(uuid,uuid,date,date,boolean,boolean)'::regprocedure) INTO def;
  IF strpos(def,$old$WHERE e.program_id = _program$old$)=0 THEN RAISE EXCEPTION 'Participation report did not match its reviewed source'; END IF;
  def:=replace(def,$old$WHERE e.program_id = _program$old$,$new$WHERE e.program_id = _program
        AND e.archived_at IS NULL$new$);
  def:=replace(def,$old$AND NOT EXISTS (SELECT 1 FROM public.owner_time_entries n WHERE n.amends_entry_id = e.id)$old$,$new$AND NOT EXISTS (SELECT 1 FROM public.owner_time_entries n WHERE n.amends_entry_id = e.id AND n.archived_at IS NULL)$new$);
  EXECUTE def;
END $patch$;
