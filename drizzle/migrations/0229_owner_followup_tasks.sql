-- Owner follow-ups: one open My Work follow-up per home while an owner is behind.
-- Replaces the retired call/text queue (owner_contact_alerts is left in place, read-only history).
-- Creates new objects only; replaces no live function, policy or trigger.

CREATE TABLE public.owner_followup_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES public.owner_programs(id),
  property_id uuid NOT NULL REFERENCES public.properties(id),
  assigned_to uuid NOT NULL,
  route_reason text NOT NULL CHECK (route_reason IN ('project_manager','no_project_manager','followup_seat','followup_cover')),
  no_project_manager boolean NOT NULL DEFAULT false,
  item_count integer NOT NULL CHECK (item_count > 0),
  title text NOT NULL,
  link_path text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  closed_by uuid,
  closed_at timestamptz,
  close_note text,
  is_demo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((status = 'open' AND closed_at IS NULL) OR (status = 'closed' AND closed_at IS NOT NULL))
);

CREATE UNIQUE INDEX owner_followup_tasks_one_open_per_home
  ON public.owner_followup_tasks (property_id) WHERE status = 'open';
CREATE INDEX owner_followup_tasks_assignee_open
  ON public.owner_followup_tasks (assigned_to) WHERE status = 'open';

REVOKE ALL ON public.owner_followup_tasks FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.owner_followup_tasks TO authenticated;
GRANT ALL ON public.owner_followup_tasks TO service_role;

ALTER TABLE public.owner_followup_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY owner_followup_tasks_read ON public.owner_followup_tasks
  FOR SELECT TO authenticated
  USING (assigned_to = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE FUNCTION public.close_owner_followup(_task_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _row public.owner_followup_tasks%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Sign in to close this follow-up.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO _row FROM public.owner_followup_tasks WHERE id = _task_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Follow-up not found.' USING ERRCODE = 'P0002';
  END IF;
  IF _row.assigned_to <> _uid AND NOT public.has_role(_uid, 'admin') THEN
    RAISE EXCEPTION 'Only the assigned teammate or an Admin can close this follow-up.' USING ERRCODE = '42501';
  END IF;
  IF _row.status = 'closed' THEN
    RETURN;
  END IF;
  UPDATE public.owner_followup_tasks
     SET status = 'closed', closed_by = _uid, closed_at = now(), close_note = 'Reached out'
   WHERE id = _task_id;
  UPDATE public.staff_notifications
     SET read_at = COALESCE(read_at, now())
   WHERE entity_type = 'owner_followup_task' AND entity_id = _task_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.close_owner_followup(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.close_owner_followup(uuid) TO authenticated, service_role;
