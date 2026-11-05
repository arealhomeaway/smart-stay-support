-- Guided ticket checklists: schema only. Templates are versioned playbook rows.

ALTER TABLE public.playbooks
  ADD COLUMN IF NOT EXISTS checklist jsonb,
  ADD COLUMN IF NOT EXISTS checklist_category text,
  ADD COLUMN IF NOT EXISTS sop_url text;

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS checklist_playbook_id uuid REFERENCES public.playbooks(id),
  ADD COLUMN IF NOT EXISTS checklist_category text;

ALTER TABLE public.ticket_steps
  ADD COLUMN IF NOT EXISTS step_key text,
  ADD COLUMN IF NOT EXISTS answer text,
  ADD COLUMN IF NOT EXISTS answer_fields jsonb,
  ADD COLUMN IF NOT EXISTS not_applicable_reason text,
  ADD COLUMN IF NOT EXISTS checklist_playbook_id uuid REFERENCES public.playbooks(id);

CREATE UNIQUE INDEX IF NOT EXISTS playbooks_one_live_checklist
  ON public.playbooks (checklist_category)
  WHERE checklist IS NOT NULL AND status = 'approved';
CREATE INDEX IF NOT EXISTS ticket_steps_checklist_idx
  ON public.ticket_steps (ticket_id, step_key) WHERE step_key IS NOT NULL;

-- Checklist rows change only through publish_ticket_checklist (or the seed),
-- and a published version never changes: edits become a new version.
CREATE OR REPLACE FUNCTION private.guard_checklist_playbook()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, private AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.checklist IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NEW.checklist IS NULL AND OLD.checklist IS NULL THEN RETURN NEW; END IF;
  IF coalesce(current_setting('resolve.checklist_publish', true), '') <> 'on' THEN
    RAISE EXCEPTION 'Ticket checklists are changed only by publishing a new version.';
  END IF;
  IF TG_OP = 'UPDATE' AND (NEW.checklist IS DISTINCT FROM OLD.checklist
      OR NEW.checklist_category IS DISTINCT FROM OLD.checklist_category
      OR NEW.version IS DISTINCT FROM OLD.version) THEN
    RAISE EXCEPTION 'A published checklist version never changes. Publish a new version instead.';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS playbooks_checklist_guard ON public.playbooks;
CREATE TRIGGER playbooks_checklist_guard BEFORE INSERT OR UPDATE ON public.playbooks
  FOR EACH ROW EXECUTE FUNCTION private.guard_checklist_playbook();

-- A ticket keeps the version it started on.
CREATE OR REPLACE FUNCTION private.guard_ticket_checklist_pin()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, private AS $$
DECLARE pb record;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.checklist_playbook_id IS DISTINCT FROM OLD.checklist_playbook_id
       OR NEW.checklist_category IS DISTINCT FROM OLD.checklist_category THEN
      RAISE EXCEPTION 'A ticket keeps the checklist version it started on.';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.checklist_playbook_id IS NULL THEN RETURN NEW; END IF;
  SELECT status, checklist_category, checklist INTO pb FROM public.playbooks WHERE id = NEW.checklist_playbook_id;
  IF pb.checklist IS NULL OR pb.status <> 'approved' OR pb.checklist_category IS DISTINCT FROM NEW.checklist_category THEN
    RAISE EXCEPTION 'That checklist version is not the live one for this category.';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS tickets_checklist_pin ON public.tickets;
CREATE TRIGGER tickets_checklist_pin BEFORE INSERT OR UPDATE OF checklist_playbook_id, checklist_category ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION private.guard_ticket_checklist_pin();

-- Checklist answers: reason required for "doesn't apply", tied to the pinned
-- version, and kept as history (never edited or deleted).
CREATE OR REPLACE FUNCTION private.guard_checklist_answer()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, private AS $$
DECLARE pinned uuid;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    IF OLD.step_key IS NOT NULL THEN
      RAISE EXCEPTION 'Checklist answers are history and cannot be changed. Answer the step again instead.';
    END IF;
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;
  IF NEW.step_key IS NULL THEN RETURN NEW; END IF;
  SELECT checklist_playbook_id INTO pinned FROM public.tickets WHERE id = NEW.ticket_id;
  IF pinned IS NULL OR NEW.checklist_playbook_id IS DISTINCT FROM pinned THEN
    RAISE EXCEPTION 'This answer does not match the checklist version on the ticket.';
  END IF;
  IF NEW.answer IS NULL OR length(trim(NEW.answer)) = 0 THEN
    RAISE EXCEPTION 'Choose an answer.';
  END IF;
  IF NEW.answer = 'not_applicable' AND length(trim(coalesce(NEW.not_applicable_reason, ''))) < 3 THEN
    RAISE EXCEPTION 'Say in one line why this step does not apply.';
  END IF;
  NEW.completed := true;
  NEW.completed_by := coalesce(NEW.completed_by, auth.uid());
  NEW.completed_at := coalesce(NEW.completed_at, now());
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS ticket_steps_checklist_answer ON public.ticket_steps;
CREATE TRIGGER ticket_steps_checklist_answer BEFORE INSERT OR UPDATE OR DELETE ON public.ticket_steps
  FOR EACH ROW EXECUTE FUNCTION private.guard_checklist_answer();

-- Publish a new version: Admin or Operations Director only. The current
-- version is retired in the same transaction; open tickets keep theirs.
CREATE OR REPLACE FUNCTION public.publish_ticket_checklist(
  _category text, _title text, _checklist jsonb, _sop_url text DEFAULT NULL, _note text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE cur record; new_id uuid; uid uuid := auth.uid();
BEGIN
  IF uid IS NULL OR NOT (private.has_role(uid, 'admin') OR private.is_director(uid)) THEN
    RAISE EXCEPTION 'Only an Admin or the Operations Director can publish a ticket checklist.';
  END IF;
  IF _category NOT IN ('lockout','cleaning','maintenance','other_complaint','damage','booking') THEN
    RAISE EXCEPTION 'Unknown checklist category.';
  END IF;
  IF jsonb_typeof(_checklist -> 'steps') <> 'array' OR jsonb_array_length(_checklist -> 'steps') = 0 THEN
    RAISE EXCEPTION 'A checklist needs at least one step.';
  END IF;
  IF length(trim(coalesce(_title, ''))) = 0 THEN RAISE EXCEPTION 'A checklist needs a title.'; END IF;
  PERFORM set_config('resolve.checklist_publish', 'on', true);
  SELECT id, version, playbook_key INTO cur FROM public.playbooks
    WHERE checklist IS NOT NULL AND checklist_category = _category AND status = 'approved'
    FOR UPDATE;
  IF cur.id IS NOT NULL THEN
    UPDATE public.playbooks SET status = 'retired', retired_at = now() WHERE id = cur.id;
  END IF;
  INSERT INTO public.playbooks (category, title, active, playbook_key, version, status, approved_by, approved_at,
      effective_on, applies_to, source, supersedes_id, review_note, checklist, checklist_category, sop_url)
  VALUES ('checklist', trim(_title), false, coalesce(cur.playbook_key, 'checklist:' || _category),
      coalesce(cur.version, 0) + 1, 'approved', uid, now(), current_date, ARRAY['ticket'], 'authored',
      cur.id, nullif(trim(coalesce(_note, '')), ''), _checklist, _category, nullif(trim(coalesce(_sop_url, '')), ''))
  RETURNING id INTO new_id;
  INSERT INTO public.audit_log (actor_id, action, entity_type, entity_id, entity_label, reason, before_value, after_value)
  VALUES (uid, 'ticket_checklist_published', 'playbook', new_id, trim(_title), nullif(trim(coalesce(_note, '')), ''),
      CASE WHEN cur.id IS NULL THEN NULL ELSE jsonb_build_object('id', cur.id, 'version', cur.version) END,
      jsonb_build_object('category', _category, 'version', coalesce(cur.version, 0) + 1));
  RETURN new_id;
END $$;
REVOKE ALL ON FUNCTION public.publish_ticket_checklist(text, text, jsonb, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publish_ticket_checklist(text, text, jsonb, text, text) TO authenticated;
