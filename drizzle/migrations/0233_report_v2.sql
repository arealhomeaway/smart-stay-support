-- Participation report v2 (STAGED, NOT APPLIED).
-- Adds: versioned report wording (Admin-only edit), a staff-reviewed legacy card map
-- (empty until Emily approves rows), a record of which wording version each report used,
-- and one read function that labels hour entries with who logged them and their card.
-- Replaces no live function, policy or trigger. Never writes owner_time_entries.
-- Seed of wording version 1 lives in 02_wording_seed.data.sql.

CREATE TABLE public.report_wording_versions (
  version int PRIMARY KEY,
  sentences jsonb NOT NULL CHECK (jsonb_typeof(sentences) = 'array' AND jsonb_array_length(sentences) = 6),
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.report_wording_versions TO authenticated;
GRANT ALL ON public.report_wording_versions TO service_role;
ALTER TABLE public.report_wording_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users read report wording" ON public.report_wording_versions
  FOR SELECT TO authenticated USING (true);

CREATE TABLE public.report_legacy_card_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_kind text NOT NULL CHECK (match_kind IN ('template_id','exact_title')),
  match_value text NOT NULL,
  card_code text NOT NULL,
  approved_by uuid,
  approved_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (match_kind, match_value)
);
GRANT SELECT ON public.report_legacy_card_map TO authenticated;
GRANT ALL ON public.report_legacy_card_map TO service_role;
ALTER TABLE public.report_legacy_card_map ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read legacy card map" ON public.report_legacy_card_map
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(),'admin') OR public.is_onboarding_director(auth.uid()) OR public.is_director(auth.uid()));

CREATE TABLE public.report_wording_uses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid,
  report_kind text NOT NULL CHECK (report_kind IN ('owner_participation','str_report')),
  report_ref uuid,
  file_format text NOT NULL CHECK (file_format IN ('pdf','csv')),
  wording_version int NOT NULL REFERENCES public.report_wording_versions(version),
  generated_by uuid NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.report_wording_uses TO authenticated;
GRANT ALL ON public.report_wording_uses TO service_role;
ALTER TABLE public.report_wording_uses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read report wording uses" ON public.report_wording_uses
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(),'admin') OR public.is_onboarding_director(auth.uid()) OR public.is_director(auth.uid()));

-- Current wording for report builders (invoker rights; table RLS applies).
CREATE FUNCTION public.report_wording_current()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER
SET search_path TO public, pg_temp AS $function$
 SELECT jsonb_build_object('version', w.version, 'sentences', w.sentences)
 FROM public.report_wording_versions w ORDER BY w.version DESC LIMIT 1
$function$;
REVOKE ALL ON FUNCTION public.report_wording_current() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.report_wording_current() TO authenticated;

CREATE FUNCTION public.report_wording_save(_sentences jsonb, _note text DEFAULT NULL)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO public, pg_temp AS $function$
DECLARE v int; s text;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN
  RAISE EXCEPTION 'Only an Admin can change report wording.' USING ERRCODE='42501';
 END IF;
 IF jsonb_typeof(_sentences) <> 'array' OR jsonb_array_length(_sentences) <> 6 THEN
  RAISE EXCEPTION 'Report wording needs exactly six sentences.';
 END IF;
 FOR s IN SELECT jsonb_array_elements_text(_sentences) LOOP
  IF length(trim(s)) = 0 THEN RAISE EXCEPTION 'Every sentence needs text.'; END IF;
  IF s ~* '\m(invest|investment|investor|investors|roi)\M' OR s LIKE '%' || chr(8212) || '%' THEN
   RAISE EXCEPTION 'Report wording cannot use that word or a long dash.';
  END IF;
 END LOOP;
 LOCK TABLE public.report_wording_versions IN SHARE ROW EXCLUSIVE MODE;
 SELECT coalesce(max(version),0)+1 INTO v FROM public.report_wording_versions;
 INSERT INTO public.report_wording_versions(version, sentences, note, created_by)
  VALUES (v, _sentences, nullif(trim(coalesce(_note,'')),''), auth.uid());
 INSERT INTO public.audit_log(actor_id, action, entity_type, entity_label, after_value)
  VALUES (auth.uid(), 'report_wording_saved', 'report_wording', 'Report wording version ' || v, jsonb_build_object('version', v));
 RETURN v;
END $function$;
REVOKE ALL ON FUNCTION public.report_wording_save(jsonb,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.report_wording_save(jsonb,text) TO authenticated;

CREATE FUNCTION public.record_report_wording_use(_program uuid, _kind text, _ref uuid, _format text, _version int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO public, private, pg_temp AS $function$
DECLARE prog uuid := _program;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to download a report.' USING ERRCODE='42501'; END IF;
 IF prog IS NULL AND _kind = 'str_report' AND _ref IS NOT NULL THEN
  SELECT s.program_id INTO prog FROM public.str_participation_reports s WHERE s.id = _ref;
 END IF;
 IF NOT (public.has_role(auth.uid(),'admin') OR public.is_director(auth.uid()) OR public.is_onboarding_director(auth.uid())
   OR (prog IS NOT NULL AND private.owner_program_readable(auth.uid(), prog))) THEN
  RAISE EXCEPTION 'This report is not available to this account.' USING ERRCODE='42501';
 END IF;
 INSERT INTO public.report_wording_uses(program_id, report_kind, report_ref, file_format, wording_version, generated_by)
  VALUES (prog, _kind, _ref, _format, _version, auth.uid());
END $function$;
REVOKE ALL ON FUNCTION public.record_report_wording_use(uuid,text,uuid,text,int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_report_wording_use(uuid,text,uuid,text,int) TO authenticated;

-- Labels only: who logged each entry and which library card it belongs to.
-- Engine link (entry review -> plan card) wins; then an approved legacy map row; else none.
-- Rows outside the caller's access are left out, never errored one by one.
CREATE FUNCTION public.report_entry_labels(_entry_ids uuid[])
RETURNS TABLE(entry_id uuid, logged_by text, card_code text, card_title text, label_source text)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO public, private, pg_temp AS $function$
DECLARE staff boolean;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to read this report.' USING ERRCODE='42501'; END IF;
 staff := public.has_role(auth.uid(),'admin') OR public.is_director(auth.uid()) OR public.is_onboarding_director(auth.uid());
 RETURN QUERY
 SELECT e.id,
  coalesce(nullif(trim(f.full_name),''), nullif(trim(f.first_name),''), 'a homeowner'),
  coalesce(lc.code, mc.code),
  coalesce(lc.title, mc.title),
  CASE WHEN lc.code IS NOT NULL THEN 'engine' WHEN mc.code IS NOT NULL THEN 'legacy_map' ELSE 'none' END
 FROM public.owner_time_entries e
 LEFT JOIN public.profiles f ON f.id = e.owner_user_id
 LEFT JOIN LATERAL (SELECT c.code, c.title FROM public.ao_home_plan_cards pc JOIN public.ao_library_cards c ON c.id = pc.card_id
   WHERE e.review_id IS NOT NULL AND pc.owner_review_id = e.review_id LIMIT 1) lc ON true
 LEFT JOIN public.owner_reviews r ON r.id = e.review_id
 LEFT JOIN LATERAL (SELECT c.code, c.title FROM public.report_legacy_card_map m JOIN public.ao_library_cards c ON c.code = m.card_code
   WHERE (m.match_kind = 'template_id' AND m.match_value = r.template_id::text)
      OR (m.match_kind = 'exact_title' AND m.match_value = e.activity)
   ORDER BY (m.match_kind = 'template_id') DESC LIMIT 1) mc ON true
 WHERE e.id = ANY(_entry_ids)
   AND (staff OR private.owner_program_readable(auth.uid(), e.program_id));
END $function$;
REVOKE ALL ON FUNCTION public.report_entry_labels(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.report_entry_labels(uuid[]) TO authenticated;
