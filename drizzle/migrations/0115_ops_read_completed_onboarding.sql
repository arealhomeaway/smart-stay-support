-- Read-only, property-scoped view of completed onboarding records for internal
-- staff (Operations included). Reuses existing rows; returns only operational
-- content: completed Tasks, their findings/observations, operational files and
-- record history. Owners and vendors are refused (private.is_staff).
CREATE OR REPLACE FUNCTION private.completed_onboarding_doc_ok(_doc public.documents, _property uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT _doc.entity_type = 'onboarding_task'
    AND _doc.archived_at IS NULL AND _doc.deleted_at IS NULL AND _doc.upload_status = 'stored'
    AND coalesce(_doc.category,'other') IN ('onboarding_evidence','reference','operations','design','other')
    AND EXISTS (SELECT 1 FROM public.onboarding_tasks t
      WHERE t.id = _doc.entity_id AND t.property_id = _property
        AND t.status = 'complete' AND t.archived_at IS NULL)
$$;

CREATE OR REPLACE FUNCTION public.read_completed_onboarding_records(_property_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE result jsonb; pid uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT coalesce(private.is_staff(auth.uid()), false) THEN
    RAISE EXCEPTION 'Completed onboarding records are available to ARHA staff only.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM properties WHERE id = _property_id AND archived_at IS NULL) THEN
    RAISE EXCEPTION 'That property is not available.';
  END IF;
  SELECT id INTO pid FROM onboarding_projects WHERE property_id = _property_id AND status <> 'cancelled'
    ORDER BY created_at DESC LIMIT 1;
  WITH done AS (
    SELECT t.* FROM onboarding_tasks t
    WHERE t.property_id = _property_id AND t.status = 'complete' AND t.archived_at IS NULL
  )
  SELECT jsonb_build_object(
    'project', (SELECT jsonb_build_object(
        'status', p.status, 'handoffState', p.handoff_state,
        'readyAt', p.ready_for_ops_at, 'readyBy', (SELECT full_name FROM profiles WHERE id = p.ready_for_ops_by),
        'acceptedAt', p.ops_accepted_at, 'acceptedBy', (SELECT full_name FROM profiles WHERE id = p.ops_accepted_by),
        'completedAt', p.completed_at,
        'projectManager', (SELECT full_name FROM profiles WHERE id = p.project_manager))
      FROM onboarding_projects p WHERE p.id = pid),
    'tasks', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'id', d.id, 'title', d.title, 'stage', d.stage, 'detail', d.detail,
        'evidenceNote', d.evidence_note, 'completedAt', d.completed_at,
        'completedBy', (SELECT full_name FROM profiles WHERE id = d.completed_by),
        'assignedTo', (SELECT full_name FROM profiles WHERE id = d.assigned_to),
        'observations', coalesce((SELECT jsonb_agg(jsonb_build_object('id', n.id, 'body', n.body, 'createdAt', n.created_at,
            'author', (SELECT full_name FROM profiles WHERE id = n.author_id)) ORDER BY n.created_at)
          FROM onboarding_notes n WHERE n.task_id = d.id AND n.archived_at IS NULL), '[]'::jsonb),
        'findings', coalesce((SELECT jsonb_agg(jsonb_build_object('id', f.id, 'title', f.title, 'detail', f.detail,
            'category', f.category, 'severity', f.severity, 'location', f.location, 'status', f.status, 'createdAt', f.created_at) ORDER BY f.created_at)
          FROM assessment_findings f WHERE f.source_task_id = d.id), '[]'::jsonb),
        'files', coalesce((SELECT jsonb_agg(jsonb_build_object('id', doc.id, 'title', doc.title,
            'filename', doc.original_filename, 'mimeType', doc.mime_type, 'sizeBytes', doc.size_bytes, 'createdAt', doc.created_at,
            'uploadedBy', (SELECT full_name FROM profiles WHERE id = doc.uploaded_by)) ORDER BY doc.created_at)
          FROM documents doc WHERE doc.entity_id = d.id AND private.completed_onboarding_doc_ok(doc, _property_id)), '[]'::jsonb)
      ) ORDER BY d.completed_at NULLS LAST, d.sort_order) FROM done d), '[]'::jsonb),
    'history', coalesce((SELECT jsonb_agg(h ORDER BY h->>'at' DESC) FROM (
        SELECT jsonb_build_object('at', d.completed_at, 'summary', 'Task completed: ' || d.title,
          'actor', (SELECT full_name FROM profiles WHERE id = d.completed_by)) h FROM done d WHERE d.completed_at IS NOT NULL
        UNION ALL
        SELECT jsonb_build_object('at', p.ready_for_ops_at, 'summary', 'Marked Ready for Operations',
          'actor', (SELECT full_name FROM profiles WHERE id = p.ready_for_ops_by)) FROM onboarding_projects p WHERE p.id = pid AND p.ready_for_ops_at IS NOT NULL
        UNION ALL
        SELECT jsonb_build_object('at', p.ops_accepted_at, 'summary', 'Accepted into live operations',
          'actor', (SELECT full_name FROM profiles WHERE id = p.ops_accepted_by)) FROM onboarding_projects p WHERE p.id = pid AND p.ops_accepted_at IS NOT NULL
      ) x), '[]'::jsonb)
  ) INTO result;
  RETURN result;
END $$;

-- Gate for attachment downloads through the read-only view.
CREATE OR REPLACE FUNCTION public.can_read_completed_onboarding_document(_document_id uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE doc documents%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT coalesce(private.is_staff(auth.uid()), false) THEN
    RAISE EXCEPTION 'Completed onboarding records are available to ARHA staff only.';
  END IF;
  SELECT * INTO doc FROM documents WHERE id = _document_id;
  IF doc.id IS NULL OR doc.property_id IS NULL OR NOT private.completed_onboarding_doc_ok(doc, doc.property_id) THEN
    RAISE EXCEPTION 'That file is not part of a completed onboarding record.';
  END IF;
  RETURN doc.storage_path;
END $$;

REVOKE ALL ON FUNCTION public.read_completed_onboarding_records(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_read_completed_onboarding_document(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.read_completed_onboarding_records(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_read_completed_onboarding_document(uuid) TO authenticated;
REVOKE ALL ON FUNCTION private.completed_onboarding_doc_ok(public.documents, uuid) FROM PUBLIC, anon, authenticated;