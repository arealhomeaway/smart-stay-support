-- Retain associations and ticket history. Stop new grouped links without deleting records.
CREATE OR REPLACE FUNCTION public.link_reported_issues_breezeway_order(_ticket_ids uuid[],_work_order_id uuid DEFAULT NULL,_task_number bigint DEFAULT NULL)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public,private AS $$
BEGIN RAISE EXCEPTION 'Linking all issues is unavailable. Nothing was linked.'; END $$;
COMMENT ON TABLE public.reported_issue_order_links IS 'Retained grouped work order link history; grouped writes disabled by undo.';
