-- PENDING ONLY. Not applied. No backfill. Called only from verified existing Breezeway reads.
CREATE OR REPLACE FUNCTION public.complete_onboarding_from_breezeway(
 _link_id uuid, _breezeway_task_id bigint, _property_id uuid, _status text,
 _task_updated_at timestamptz, _property_updated_at timestamptz, _project_updated_at timestamptz,
 _breezeway_updated_at timestamptz
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE link breezeway_outbound_tasks%ROWTYPE; task onboarding_tasks%ROWTYPE;
 home properties%ROWTYPE; project onboarding_projects%ROWTYPE; capture jsonb;
BEGIN
 IF coalesce(auth.role(),'') <> 'service_role' THEN RAISE EXCEPTION 'Integration access required.'; END IF;
 IF lower(coalesce(_status,'')) NOT IN ('finished','approved','closed','completed','complete') THEN RETURN false; END IF;
 -- Same home-first lock order as canonical handoff/readiness, then Tasks and outbound records.
 SELECT * INTO project FROM onboarding_projects WHERE property_id=_property_id AND status<>'cancelled' FOR UPDATE;
 SELECT * INTO home FROM properties WHERE id=_property_id AND archived_at IS NULL FOR UPDATE;
 IF project.id IS NULL OR home.id IS NULL THEN RETURN false; END IF;
 PERFORM id FROM onboarding_tasks WHERE property_id=_property_id AND archived_at IS NULL ORDER BY id FOR UPDATE;
 SELECT * INTO link FROM breezeway_outbound_tasks WHERE id=_link_id AND source_type='onboarding_task'
  AND breezeway_task_id=_breezeway_task_id AND property_id=_property_id FOR UPDATE;
 IF link.id IS NULL OR link.onboarding_task_id IS NULL THEN RETURN false; END IF;
 IF NOT EXISTS(SELECT 1 FROM breezeway_property_links WHERE property_id=_property_id AND breezeway_home_id=link.breezeway_home_id AND mapping_state='verified') THEN RETURN false; END IF;
 SELECT * INTO task FROM onboarding_tasks WHERE id=link.onboarding_task_id AND property_id=_property_id AND archived_at IS NULL;
 IF task.id IS NULL OR task.status IN ('complete','carryover') OR task.completed_at IS NOT NULL THEN RETURN false; END IF;
 IF task.updated_at IS DISTINCT FROM _task_updated_at OR home.updated_at IS DISTINCT FROM _property_updated_at
  OR project.updated_at IS DISTINCT FROM _project_updated_at THEN RETURN false; END IF;
 IF project.completed_at IS NOT NULL OR home.handoff_accepted_at IS NOT NULL OR home.lifecycle_status IN ('handoff_requested','active_operations')
  OR private.onboarding_work_locked(ARRAY[_property_id]) THEN RETURN false; END IF;
 IF coalesce(task.blocker,'')<>'' OR (task.evidence_required AND btrim(coalesce(task.evidence_note,''))='')
  OR (task.requires_owner_approval AND task.owner_approval_status IS DISTINCT FROM 'approved') THEN RETURN false; END IF;
 SELECT new_value::jsonb INTO capture FROM onboarding_project_events WHERE project_id=project.id AND kind='stage_capture:'||task.stage
  ORDER BY (new_value::jsonb->>'revision')::integer DESC LIMIT 1;
 IF capture->>'status' IN ('complete','awaiting_review') THEN RETURN false; END IF;
 UPDATE onboarding_tasks SET status='complete',completed_at=now(),completed_by=NULL WHERE id=task.id;
 INSERT INTO audit_log(actor_label,action,entity_type,entity_id,entity_label,reason,before_value,after_value)
 VALUES('Breezeway','onboarding_task_completed_in_breezeway','onboarding_task',task.id,task.title,'Completed in Breezeway',
  jsonb_build_object('status',task.status),jsonb_build_object('status','complete','breezeway_task_id',_breezeway_task_id,'breezeway_updated_at',_breezeway_updated_at));
 INSERT INTO onboarding_notes(property_id,task_id,body,is_demo)
 VALUES(_property_id,task.id,'Completed in Breezeway',coalesce(task.is_demo,false));
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.complete_onboarding_from_breezeway(uuid,bigint,uuid,text,timestamptz,timestamptz,timestamptz,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.complete_onboarding_from_breezeway(uuid,bigint,uuid,text,timestamptz,timestamptz,timestamptz,timestamptz) TO service_role;