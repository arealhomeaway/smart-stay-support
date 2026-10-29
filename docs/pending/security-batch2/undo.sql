-- Security batch 2 undo. Byte-exact pre-change definitions (sha256 verified), then RESET search_path (proconfig was NULL).

-- block_audit_log_mutation() proconfig=NULL sha256=04ea09b476d06aa447ad89ea131999c3aefe2176d8dc816b8210f9d8a51464f9
CREATE OR REPLACE FUNCTION public.block_audit_log_mutation()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  RAISE EXCEPTION 'The audit log is permanent and cannot be changed or deleted.'
    USING ERRCODE = '42501';
END;
$function$
;
ALTER FUNCTION block_audit_log_mutation() RESET search_path;

-- block_contact_attempt_mutation() proconfig=NULL sha256=670e1f38210e057526f5117a1a2c617384909fc6a1a7f41e51ddc020007ad716
CREATE OR REPLACE FUNCTION public.block_contact_attempt_mutation()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN RAISE EXCEPTION 'Contact attempts are append-only'; END $function$
;
ALTER FUNCTION block_contact_attempt_mutation() RESET search_path;

-- block_match_event_mutation() proconfig=NULL sha256=9d5a49ed120c9f2d04a16de3af9fe07ed6836813f1942ddd7e33a90bdebc59f9
CREATE OR REPLACE FUNCTION public.block_match_event_mutation()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN RAISE EXCEPTION 'Match history is append-only'; END $function$
;
ALTER FUNCTION block_match_event_mutation() RESET search_path;

-- block_owner_library_video_delete() proconfig=NULL sha256=b20155b54763f5eeb8b5a2ad0e71a34392f538beb531d89f498a01ac43746b0b
CREATE OR REPLACE FUNCTION public.block_owner_library_video_delete()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN RAISE EXCEPTION 'Library video history cannot be deleted'; END $function$
;
ALTER FUNCTION block_owner_library_video_delete() RESET search_path;

-- block_template_version_mutation() proconfig=NULL sha256=04a958234356ecb0d07332bde6750d3d187f5cfcee094885a227ab71e0e4237e
CREATE OR REPLACE FUNCTION public.block_template_version_mutation()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN RAISE EXCEPTION 'Published template versions cannot be changed. Publish a new version instead.'; END $function$
;
ALTER FUNCTION block_template_version_mutation() RESET search_path;

-- expense_purchase_auth_guard() proconfig=NULL sha256=288b8c6245f3ae6699b301f3a5a5e1d3cf5fb8fe7abc04af2a020fafeeda3e83
CREATE OR REPLACE FUNCTION public.expense_purchase_auth_guard()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.expense_type = 'purchase' AND NEW.purchase_auth_status IN ('missing','uncertain')
     AND NEW.cost_responsibility IN ('owner','split') AND NEW.leadership_decision IS NULL THEN
    RAISE EXCEPTION 'Purchase authorization is missing or uncertain — record a leadership decision before allocating to the owner';
  END IF;
  RETURN NEW;
END $function$
;
ALTER FUNCTION expense_purchase_auth_guard() RESET search_path;

-- private.block_completion_review_mutation() proconfig=NULL sha256=5ce5a209f68e1c459ab42bc9a7a29108f0b309f5bd493deee41b2921cc01e0fe
CREATE OR REPLACE FUNCTION private.block_completion_review_mutation()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN RAISE EXCEPTION 'Owner completion review history is append-only.'; END $function$
;
ALTER FUNCTION private.block_completion_review_mutation() RESET search_path;

-- private.block_expense_event_mutation() proconfig=NULL sha256=b14ee02985a00ac77c2320c27c592238e5d54ef4c15e8fbd953b0691668cf6d1
CREATE OR REPLACE FUNCTION private.block_expense_event_mutation()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN RAISE EXCEPTION 'Expense history is append-only'; END $function$
;
ALTER FUNCTION private.block_expense_event_mutation() RESET search_path;

-- private.block_owner_message_mutation() proconfig=NULL sha256=48cc3d98aa4583064d1b73924769acf0131632a562fc93aaa5f5b33f102d1446
CREATE OR REPLACE FUNCTION private.block_owner_message_mutation()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN RAISE EXCEPTION 'Conversation messages are permanent history and cannot be changed or removed.'; END $function$
;
ALTER FUNCTION private.block_owner_message_mutation() RESET search_path;

-- private.business_today() proconfig=NULL sha256=dbffd49ffd202e0da75b9cf43d3a9341a09e0d3d6863492b95bd6c87c9f458bb
CREATE OR REPLACE FUNCTION private.business_today()
 RETURNS date
 LANGUAGE sql
 STABLE
AS $function$ SELECT (now() AT TIME ZONE 'America/Chicago')::date $function$
;
ALTER FUNCTION private.business_today() RESET search_path;

-- private.cleaner_parse_elapsed(text) proconfig=NULL sha256=22c5d35a9d20b6fcd31450c2f782d617ce8540094c44f86cb79aa6b6c85e865b
CREATE OR REPLACE FUNCTION private.cleaner_parse_elapsed(_t text)
 RETURNS integer
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
DECLARE m text[]; days int := 0;
BEGIN
  IF _t IS NULL OR btrim(_t) = '' THEN RETURN NULL; END IF;
  m := regexp_match(btrim(_t), '^(?:(\d+) days?, )?(\d+):(\d{2}):(\d{2})(?:\.\d+)?$');
  IF m IS NULL THEN RETURN NULL; END IF;
  days := coalesce(m[1]::int, 0);
  RETURN days*86400 + m[2]::int*3600 + m[3]::int*60 + m[4]::int;
END $function$
;
ALTER FUNCTION private.cleaner_parse_elapsed(text) RESET search_path;

-- private.cleaner_safeguard_state(numeric,numeric) proconfig=NULL sha256=9da3100fa75aae749d1f01994274fe5bb727a0f3753ff74b0c1d366563a8f201
CREATE OR REPLACE FUNCTION private.cleaner_safeguard_state(_total_h numeric, _owner_h numeric)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT CASE
    WHEN _total_h >= 95 THEN 'hard_block'
    WHEN coalesce(_owner_h,0) <= 0 THEN
      CASE WHEN _total_h >= 75 THEN 'restricted' WHEN _total_h >= 50 THEN 'warning' WHEN _total_h >= 35 THEN 'monitor' ELSE 'normal' END
    WHEN _total_h >= 75 OR (_owner_h - _total_h) <= 5 THEN 'restricted'
    WHEN _total_h >= 50 OR (_owner_h - _total_h) <= 15 THEN 'warning'
    WHEN _total_h >= 35 OR (_owner_h - _total_h) <= 25 THEN 'monitor'
    ELSE 'normal' END
$function$
;
ALTER FUNCTION private.cleaner_safeguard_state(numeric,numeric) RESET search_path;

-- private.cleaner_state_rank(text) proconfig=NULL sha256=d01d225fe2ecd7c58ea340688c97f3c3ed9c8386f344d6983a0b03b823de4072
CREATE OR REPLACE FUNCTION private.cleaner_state_rank(_s text)
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT CASE _s WHEN 'warning' THEN 1 WHEN 'restricted' THEN 2 WHEN 'inversion' THEN 2 WHEN 'hard_block' THEN 3 ELSE 0 END
$function$
;
ALTER FUNCTION private.cleaner_state_rank(text) RESET search_path;

-- private.expense_evidence_changed(expenses,expenses) proconfig=NULL sha256=508b28b78e58c40e2b7ebf1b3df999572f57596c9eeefeac548834dd8e43eefb
CREATE OR REPLACE FUNCTION private.expense_evidence_changed(o expenses, n expenses)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT coalesce((SELECT array_agg(x ORDER BY x) FROM unnest(o.invoice_document_ids) x),'{}')
           IS DISTINCT FROM coalesce((SELECT array_agg(x ORDER BY x) FROM unnest(n.invoice_document_ids) x),'{}')
      OR coalesce(o.photos_required,false) IS DISTINCT FROM coalesce(n.photos_required,false)
      OR (coalesce(n.photos_required,false) AND
          coalesce((SELECT array_agg(x ORDER BY x) FROM unnest(o.photo_document_ids) x),'{}')
           IS DISTINCT FROM coalesce((SELECT array_agg(x ORDER BY x) FROM unnest(n.photo_document_ids) x),'{}'))
$function$
;
ALTER FUNCTION private.expense_evidence_changed(expenses,expenses) RESET search_path;

-- private.expense_split_ok(jsonb,numeric) proconfig=NULL sha256=2564f440241b5fe13f98ef5f747277204e288d9aba287d7299964565204be285
CREATE OR REPLACE FUNCTION private.expense_split_ok(_alloc jsonb, _amount numeric)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT jsonb_typeof(_alloc) = 'array' AND jsonb_array_length(_alloc) >= 2 AND _amount IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(_alloc) e
      WHERE (e->>'party') NOT IN ('owner','arha','guest','vendor','insurance') OR (e->>'amount') IS NULL OR (e->>'amount')::numeric < 0)
    AND (SELECT coalesce(sum((e->>'amount')::numeric),0) FROM jsonb_array_elements(_alloc) e) = _amount
$function$
;
ALTER FUNCTION private.expense_split_ok(jsonb,numeric) RESET search_path;

-- private.guard_property_work_record() proconfig=NULL sha256=40871b119ff67f112912b4b753b2a5418c91c7f2045bbb1d370841b738fa1ad2
CREATE OR REPLACE FUNCTION private.guard_property_work_record()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Work records are append-only.'; END IF;
  IF TG_OP = 'UPDATE' THEN
    IF (to_jsonb(NEW) - 'superseded_at') IS DISTINCT FROM (to_jsonb(OLD) - 'superseded_at') OR OLD.superseded_at IS NOT NULL THEN
      RAISE EXCEPTION 'Work records are append-only; add a superseding record instead.';
    END IF;
    RETURN NEW;
  END IF;
  IF EXISTS (SELECT 1 FROM public.property_work_sources s WHERE s.code = NEW.source_code AND s.counts_toward_cleaner_safeguard) THEN
    RAISE EXCEPTION 'Cleaning time is recorded in the cleaner ledger, not here.';
  END IF;
  RETURN NEW;
END $function$
;
ALTER FUNCTION private.guard_property_work_record() RESET search_path;

-- private.guard_statement_history() proconfig=NULL sha256=626c6795f7acd07ce33646708458bb5ad48acef4b3b7a83024500fb1c0f6cb6d
CREATE OR REPLACE FUNCTION private.guard_statement_history()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Statement review history is permanent'; END IF;
  IF coalesce(current_setting('resolve.statement', true),'off') <> 'on' THEN
    RAISE EXCEPTION 'Statement review history is permanent';
  END IF;
  RETURN NEW;
END $function$
;
ALTER FUNCTION private.guard_statement_history() RESET search_path;

-- private.str_report_owner_safe(jsonb,boolean) proconfig=NULL sha256=5e44748ed5f9cf1b96caf35cbdf2cc84d0e6f1542d43f86d11bd29405817d6be
CREATE OR REPLACE FUNCTION private.str_report_owner_safe(_built jsonb, _excluded boolean)
 RETURNS jsonb
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT (_built - 'blockers' - 'rows')
    || jsonb_build_object('rows', coalesce((SELECT jsonb_agg(r - 'internal') FROM jsonb_array_elements(_built->'rows') r), '[]'::jsonb))
    || CASE WHEN _excluded OR (_built->'totals'->>'underReview')::int > 0
            THEN jsonb_build_object('underReviewNote','Some operational activity records remain under review and are not included in finalized time totals.')
            ELSE '{}'::jsonb END
$function$
;
ALTER FUNCTION private.str_report_owner_safe(jsonb,boolean) RESET search_path;

-- private.str_report_refs(jsonb) proconfig=NULL sha256=01eacf946d135b1ef58ffc9e74f35251643f942662ed62676a6041da913bdda0
CREATE OR REPLACE FUNCTION private.str_report_refs(_built jsonb)
 RETURNS jsonb
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT coalesce(jsonb_agg(r->'internal'), '[]'::jsonb) FROM jsonb_array_elements(_built->'rows') r
$function$
;
ALTER FUNCTION private.str_report_refs(jsonb) RESET search_path;

-- private.vendor_gate_passes(text,date,boolean,boolean,boolean) proconfig=NULL sha256=1bd88c81dca72b8da9e88bfa85506013b2fccc6886374edc83f2f327a359569e
CREATE OR REPLACE FUNCTION private.vendor_gate_passes(_result text, _expires date, _na boolean, _eq boolean, _expiry_required boolean)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT CASE
    WHEN _result = 'not_applicable' THEN _na
    WHEN _result IN ('verified_meets','equivalent_verified') THEN
      (_result = 'verified_meets' OR _eq)
      AND NOT (_expiry_required AND _expires IS NULL)
      AND (_expires IS NULL OR _expires >= current_date)
    ELSE false END
$function$
;
ALTER FUNCTION private.vendor_gate_passes(text,date,boolean,boolean,boolean) RESET search_path;

-- wo_authorization_snapshot() proconfig=NULL sha256=902d4f5e953987abd1167a02f7304bf7c76a6bab96d58d9df453e238ed1af590
CREATE OR REPLACE FUNCTION public.wo_authorization_snapshot()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE newly boolean;
BEGIN
  IF NEW.vendor_org_id IS NOT NULL AND NEW.vendor_org_id IS DISTINCT FROM OLD.vendor_org_id
     AND EXISTS (SELECT 1 FROM public.work_order_vendor_candidates c WHERE c.work_order_id = NEW.id)
     AND NOT EXISTS (SELECT 1 FROM public.work_order_vendor_candidates c WHERE c.work_order_id = NEW.id AND c.status = 'accepted' AND c.vendor_org_id = NEW.vendor_org_id) THEN
    RAISE EXCEPTION 'Change the vendor through Find a Vendor — the new vendor must accept first';
  END IF;
  newly := (NEW.approval_status = 'approved' AND OLD.approval_status IS DISTINCT FROM 'approved')
        OR (NEW.supervisor_approval_status = 'approved' AND OLD.supervisor_approval_status IS DISTINCT FROM 'approved');
  IF newly THEN
    NEW.authorized_scope := NEW.scope;
    NEW.authorized_amount := COALESCE(NEW.approved_amount, NEW.quote_amount);
    NEW.authorized_vendor_org_id := NEW.vendor_org_id;
    NEW.authorized_at := now();
    NEW.authorization_stale := false;
  ELSIF NEW.authorized_at IS NOT NULL AND (
        NEW.scope IS DISTINCT FROM NEW.authorized_scope
     OR (NEW.authorized_amount IS NOT NULL AND COALESCE(NEW.quote_amount, 0) > NEW.authorized_amount)
     OR (NEW.authorized_vendor_org_id IS NOT NULL AND NEW.vendor_org_id IS DISTINCT FROM NEW.authorized_vendor_org_id)) THEN
    NEW.authorization_stale := true;
  END IF;
  -- Dispatch needs current authorization: never while stale or while a required approval is undecided/declined.
  IF NEW.dispatched_at IS NOT NULL AND OLD.dispatched_at IS NULL THEN
    IF NEW.authorization_stale THEN RAISE EXCEPTION 'The approval no longer covers this vendor, scope or amount — get it re-approved before dispatch'; END IF;
    IF NEW.approval_status IN ('pending','declined','info_requested') OR NEW.supervisor_approval_status IN ('pending','declined','info_requested') THEN
      RAISE EXCEPTION 'Required approval is not in place yet — dispatch after it is approved';
    END IF;
  END IF;
  IF NEW.breezeway_handoff_status IN ('sent','simulated') AND OLD.breezeway_handoff_status NOT IN ('sent','simulated') THEN
    IF NOT EXISTS (SELECT 1 FROM public.work_order_vendor_candidates c WHERE c.work_order_id = NEW.id AND c.status = 'accepted') THEN
      RAISE EXCEPTION 'A vendor must accept before the Breezeway handoff';
    END IF;
    IF NEW.authorization_stale THEN RAISE EXCEPTION 'The approval no longer covers this vendor, scope or amount'; END IF;
  END IF;
  IF OLD.breezeway_handoff_status = 'uncertain' AND NEW.breezeway_handoff_status = 'failed'
     AND NEW.breezeway_handoff_error IS NOT DISTINCT FROM OLD.breezeway_handoff_error THEN
    RAISE EXCEPTION 'Record what was found in Breezeway before marking the handoff as not created';
  END IF;
  IF OLD.breezeway_task_ref IS NOT NULL AND NEW.breezeway_task_ref IS DISTINCT FROM OLD.breezeway_task_ref THEN
    RAISE EXCEPTION 'The external task reference cannot be changed';
  END IF;
  RETURN NEW;
END $function$
;
ALTER FUNCTION wo_authorization_snapshot() RESET search_path;
