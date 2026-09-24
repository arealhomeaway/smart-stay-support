CREATE TABLE public.owner_opportunity_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  summary text NOT NULL DEFAULT '',
  what text NOT NULL DEFAULT '',
  why text NOT NULL DEFAULT '',
  how text NOT NULL DEFAULT '',
  ways_to_document text NOT NULL DEFAULT '',
  suggested_minutes integer,
  category text NOT NULL DEFAULT 'research',
  image_key text NOT NULL DEFAULT 'research',
  tags text[] NOT NULL DEFAULT '{}',
  resource_label text,
  resource_url text,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.owner_opportunity_library TO authenticated;
GRANT ALL ON public.owner_opportunity_library TO service_role;
ALTER TABLE public.owner_opportunity_library ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users read active library" ON public.owner_opportunity_library FOR SELECT TO authenticated
  USING (active OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
CREATE POLICY "Leadership adds library templates" ON public.owner_opportunity_library FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
CREATE POLICY "Leadership edits library templates" ON public.owner_opportunity_library FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
CREATE TRIGGER owner_opportunity_library_updated BEFORE UPDATE ON public.owner_opportunity_library
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.work_items DROP CONSTRAINT work_items_source_check;
ALTER TABLE public.work_items ADD CONSTRAINT work_items_source_check CHECK (source = ANY (ARRAY['arha','rai','optional_library']));
ALTER TABLE public.work_items ADD COLUMN library_template_id uuid REFERENCES public.owner_opportunity_library(id);
ALTER TABLE public.work_items ADD COLUMN retired_at timestamptz;
ALTER TABLE public.work_items ADD COLUMN retired_reason text;
CREATE UNIQUE INDEX work_items_one_optional_per_home ON public.work_items(library_template_id, property_id)
  WHERE library_template_id IS NOT NULL AND status <> 'archived';

-- The owner starts one library idea for exactly one of their enrolled homes.
CREATE OR REPLACE FUNCTION public.start_optional_opportunity(_template_id uuid, _property_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE t record; _prog uuid; _existing uuid; _id uuid; _demo boolean;
BEGIN
  IF _property_id IS NULL THEN RAISE EXCEPTION 'Choose which home you would like to work on.'; END IF;
  SELECT * INTO t FROM owner_opportunity_library WHERE id=_template_id AND active;
  IF t IS NULL THEN RAISE EXCEPTION 'This Opportunity is no longer offered.'; END IF;
  SELECT p.id, coalesce(p.is_demo,false) INTO _prog, _demo FROM owner_program_properties pp JOIN owner_programs p ON p.id=pp.program_id
   WHERE pp.property_id=_property_id AND pp.inclusion_status='included' AND pp.archived_at IS NULL
     AND p.archived_at IS NULL AND p.owner_user_id=auth.uid() LIMIT 1;
  IF _prog IS NULL THEN RAISE EXCEPTION 'That home is not part of your program.'; END IF;
  SELECT id INTO _existing FROM work_items WHERE library_template_id=_template_id AND property_id=_property_id AND status<>'archived';
  IF _existing IS NOT NULL THEN RETURN _existing; END IF;
  _id := gen_random_uuid();
  INSERT INTO work_items(id, department, kind, property_id, source_table, source_id, program_id, title, owner_content,
      functional_role, required, blocks_handoff, is_demo, source, library_template_id, response_types, sent_at, viewed_at, status)
  VALUES (_id, 'onboarding', 'opportunity', _property_id, 'owner_opportunity_library', _id, _prog, t.title,
      jsonb_build_object('title',t.title,'summary',t.summary,'what',t.what,'why',t.why,'how',t.how,
        'ways_to_document',t.ways_to_document,'suggested_minutes',t.suggested_minutes,'image_key',t.image_key,
        'category',t.category,'resource_label',t.resource_label,'resource_url',t.resource_url),
      'owner', false, false, _demo, 'optional_library', _template_id, '{}', now(), now(), 'open');
  RETURN _id;
END $$;
REVOKE ALL ON FUNCTION public.start_optional_opportunity(uuid,uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.start_optional_opportunity(uuid,uuid) TO authenticated;

-- Template tasks no longer auto-publish generic owner Opportunities.
CREATE OR REPLACE FUNCTION public.sync_onboarding_work_item()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE wid uuid;
BEGIN
  IF TG_OP='DELETE' THEN
    UPDATE work_items SET status='archived' WHERE source_table='onboarding_tasks' AND source_id=OLD.id;
    RETURN OLD;
  END IF;
  INSERT INTO work_items(department,kind,property_id,source_table,source_id,title,status,functional_role,assigned_to,due_on,required,blocks_handoff,completed_at,is_demo)
  VALUES ('onboarding','task',NEW.property_id,'onboarding_tasks',NEW.id,NEW.title,
          CASE WHEN NEW.archived_at IS NOT NULL THEN 'archived' ELSE NEW.status END,
          NEW.assigned_seat,NEW.assigned_to,NEW.due_on,NEW.is_required,NEW.blocks_handoff,NEW.completed_at,coalesce(NEW.is_demo,false))
  ON CONFLICT (source_table,source_id,kind) DO UPDATE SET title=EXCLUDED.title,status=EXCLUDED.status,
    functional_role=EXCLUDED.functional_role,assigned_to=EXCLUDED.assigned_to,due_on=EXCLUDED.due_on,
    required=EXCLUDED.required,blocks_handoff=EXCLUDED.blocks_handoff,completed_at=EXCLUDED.completed_at
  RETURNING id INTO wid;
  -- Owner Opportunities now come only from intentional ARHA Owner Collaboration
  -- (staff create and send them from the Task) or from the Optional Library
  -- when the homeowner starts one.
  RETURN NEW;
END $function$;

COMMENT ON COLUMN public.onboarding_template_tasks.opportunity IS 'DEPRECATED for auto-publishing: owner Opportunities are created through ARHA Owner Collaboration or the Optional Opportunity Library.';