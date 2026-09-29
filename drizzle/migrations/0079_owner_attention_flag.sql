ALTER TABLE public.work_items
  ADD COLUMN IF NOT EXISTS needs_owner_attention boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS owner_attention_set_at timestamptz,
  ADD COLUMN IF NOT EXISTS owner_attention_set_by uuid;

COMMENT ON COLUMN public.work_items.needs_owner_attention IS 'Staff-set owner-priority flag (Needs Your Attention). Separate from workflow status; auto-cleared on completion.';

-- Staff-only: flag or clear owner priority. Never changes workflow status.
CREATE OR REPLACE FUNCTION public.set_owner_attention(_id uuid, _on boolean)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE w record; _name text;
BEGIN
  IF NOT (public.is_onboarding_staff(auth.uid()) OR public.is_staff(auth.uid())) THEN
    RAISE EXCEPTION 'Only ARHA staff can change owner priority.';
  END IF;
  SELECT * INTO w FROM work_items WHERE id=_id AND kind='opportunity' AND status NOT IN ('draft','archived') FOR UPDATE;
  IF w.id IS NULL THEN RAISE EXCEPTION 'This Opportunity is not available.'; END IF;
  IF _on AND w.status='complete' THEN RAISE EXCEPTION 'A resolved Opportunity cannot be flagged. Reopen it first.'; END IF;
  IF w.needs_owner_attention = _on THEN RETURN; END IF;
  SELECT coalesce(full_name,'ARHA staff') INTO _name FROM profiles WHERE id=auth.uid();
  UPDATE work_items SET needs_owner_attention=_on,
    owner_attention_set_at = CASE WHEN _on THEN now() ELSE NULL END,
    owner_attention_set_by = CASE WHEN _on THEN auth.uid() ELSE NULL END
  WHERE id=w.id;
  INSERT INTO audit_log(actor_id, actor_label, action, entity_type, entity_id, entity_label, before_value, after_value)
  VALUES (auth.uid(), _name, CASE WHEN _on THEN 'owner_attention_flagged' ELSE 'owner_attention_cleared' END,
          'work_item', w.id, w.title,
          jsonb_build_object('needs_owner_attention', w.needs_owner_attention),
          jsonb_build_object('needs_owner_attention', _on, 'via', 'manual'));
END $$;
REVOKE ALL ON FUNCTION public.set_owner_attention(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_owner_attention(uuid, boolean) TO authenticated;

-- Any path that completes an Opportunity clears the flag and records it.
CREATE OR REPLACE FUNCTION public.auto_clear_owner_attention()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status = 'complete' AND OLD.status IS DISTINCT FROM 'complete' AND OLD.needs_owner_attention THEN
    NEW.needs_owner_attention := false;
    NEW.owner_attention_set_at := NULL;
    NEW.owner_attention_set_by := NULL;
    INSERT INTO audit_log(actor_id, action, entity_type, entity_id, entity_label, before_value, after_value)
    VALUES (auth.uid(), 'owner_attention_cleared', 'work_item', NEW.id, NEW.title,
            jsonb_build_object('needs_owner_attention', true, 'flagged_at', OLD.owner_attention_set_at, 'flagged_by', OLD.owner_attention_set_by),
            jsonb_build_object('needs_owner_attention', false, 'via', 'auto_resolution'));
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_auto_clear_owner_attention ON public.work_items;
CREATE TRIGGER trg_auto_clear_owner_attention BEFORE UPDATE OF status ON public.work_items
  FOR EACH ROW EXECUTE FUNCTION public.auto_clear_owner_attention();