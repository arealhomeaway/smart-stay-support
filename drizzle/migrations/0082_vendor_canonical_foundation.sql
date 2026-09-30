
-- ---------- Lifecycle ----------
UPDATE public.vendor_orgs SET status = CASE status
  WHEN 'potential' THEN 'candidate' WHEN 'screening' THEN 'candidate' WHEN 'legacy' THEN 'candidate'
  WHEN 'trial' THEN 'pilot' WHEN 'restricted' THEN 'corrective_action'
  WHEN 'paused' THEN 'suspended' WHEN 'removed' THEN 'inactive' ELSE status END;
ALTER TABLE public.vendor_orgs ALTER COLUMN status SET DEFAULT 'candidate';
ALTER TABLE public.vendor_orgs ADD CONSTRAINT vendor_orgs_status_chk
  CHECK (status IN ('candidate','pilot','approved','gold','corrective_action','suspended','inactive'));

-- ---------- Canonical fields ----------
ALTER TABLE public.vendor_orgs
  ADD COLUMN is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN dispatch_method text NOT NULL DEFAULT 'setup_incomplete'
    CHECK (dispatch_method IN ('breezeway','internal_email','arha_staff','setup_incomplete')),
  ADD COLUMN breezeway_person_id text,
  ADD COLUMN work_order_email text,
  ADD COLUMN tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN source_system text NOT NULL DEFAULT 'resolve',
  ADD COLUMN legacy_notion_id text,
  ADD COLUMN migration_status text,
  ADD COLUMN legacy_fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN custom_fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN compliance_status text NOT NULL DEFAULT 'incomplete'
    CHECK (compliance_status IN ('incomplete','compliant','expiring','non_compliant')),
  ADD COLUMN score_capacity int CHECK (score_capacity BETWEEN 0 AND 20),
  ADD COLUMN score_responsiveness int CHECK (score_responsiveness BETWEEN 0 AND 15),
  ADD COLUMN score_quality int CHECK (score_quality BETWEEN 0 AND 20),
  ADD COLUMN score_hospitality int CHECK (score_hospitality BETWEEN 0 AND 15),
  ADD COLUMN score_communication int CHECK (score_communication BETWEEN 0 AND 10),
  ADD COLUMN score_pricing int CHECK (score_pricing BETWEEN 0 AND 10),
  ADD COLUMN score_references int CHECK (score_references BETWEEN 0 AND 10),
  ADD COLUMN qualification_score int GENERATED ALWAYS AS (
    coalesce(score_capacity,0)+coalesce(score_responsiveness,0)+coalesce(score_quality,0)+
    coalesce(score_hospitality,0)+coalesce(score_communication,0)+coalesce(score_pricing,0)+
    coalesce(score_references,0)) STORED,
  ADD COLUMN performance_score numeric,
  ADD COLUMN jobs_90d int NOT NULL DEFAULT 0,
  ADD COLUMN critical_failure boolean NOT NULL DEFAULT false,
  ADD COLUMN last_review_on date,
  ADD COLUMN next_review_on date,
  ADD COLUMN program_owner uuid,
  ADD COLUMN open_corrective_action text,
  ADD COLUMN corrective_action_due date;
CREATE UNIQUE INDEX vendor_orgs_legacy_notion_uq ON public.vendor_orgs(legacy_notion_id) WHERE legacy_notion_id IS NOT NULL;

-- ---------- Config: markets & categories ----------
CREATE TABLE public.vendor_markets (
  code text PRIMARY KEY, label text NOT NULL, active boolean NOT NULL DEFAULT true, sort_order int NOT NULL DEFAULT 0);
GRANT SELECT ON public.vendor_markets TO authenticated;
GRANT ALL ON public.vendor_markets TO service_role;
ALTER TABLE public.vendor_markets ENABLE ROW LEVEL SECURITY;
CREATE POLICY vendor_markets_read ON public.vendor_markets FOR SELECT TO authenticated USING (private.is_staff(auth.uid()));
CREATE POLICY vendor_markets_write ON public.vendor_markets FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
GRANT INSERT, UPDATE ON public.vendor_markets TO authenticated;
INSERT INTO public.vendor_markets(code,label,sort_order) VALUES
 ('OKC','OKC',1),('Tulsa','Tulsa',2),('DFW','DFW',3),('Indy','Indy',4),('Eufaula','Eufaula',5),('Houston','Houston',6);

CREATE TABLE public.vendor_service_categories (
  label text PRIMARY KEY, tier text NOT NULL CHECK (tier IN ('critical','core','specialty')),
  active boolean NOT NULL DEFAULT true, sort_order int NOT NULL DEFAULT 0);
GRANT SELECT, INSERT, UPDATE ON public.vendor_service_categories TO authenticated;
GRANT ALL ON public.vendor_service_categories TO service_role;
ALTER TABLE public.vendor_service_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY vsc_read ON public.vendor_service_categories FOR SELECT TO authenticated USING (private.is_staff(auth.uid()));
CREATE POLICY vsc_write ON public.vendor_service_categories FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
INSERT INTO public.vendor_service_categories(label,tier,sort_order) VALUES
 ('Plumbing','critical',1),('HVAC','critical',2),('Electrical','critical',3),('Locksmith / Access','critical',4),
 ('Water / Fire / Sewage Mitigation','critical',5),('Turnover Cleaning','critical',6),
 ('Handyman','core',10),('Appliance Repair','core',11),('Pest Control','core',12),('Landscaping','core',13),
 ('Pool / Hot Tub','core',14),('Roofing','core',15),('Garage Door','core',16),
 ('Painting','specialty',20),('Flooring','specialty',21),('Carpet Cleaning','specialty',22),('Junk Removal','specialty',23),
 ('Window Cleaning','specialty',24),('Furniture Assembly','specialty',25);

-- ---------- Market coverage (vendor x market x category) ----------
CREATE TABLE public.vendor_market_coverage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.vendor_orgs(id) ON DELETE CASCADE,
  market text NOT NULL REFERENCES public.vendor_markets(code),
  service_category text NOT NULL REFERENCES public.vendor_service_categories(label),
  preference text NOT NULL DEFAULT 'other' CHECK (preference IN ('primary','backup','other')),
  created_by uuid DEFAULT auth.uid(), created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, market, service_category));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_market_coverage TO authenticated;
GRANT ALL ON public.vendor_market_coverage TO service_role;
ALTER TABLE public.vendor_market_coverage ENABLE ROW LEVEL SECURITY;
CREATE POLICY vmc_read ON public.vendor_market_coverage FOR SELECT TO authenticated USING (private.is_staff(auth.uid()));
CREATE POLICY vmc_write ON public.vendor_market_coverage FOR ALL TO authenticated USING (private.is_supervisor(auth.uid())) WITH CHECK (private.is_supervisor(auth.uid()));

-- ---------- Custom fields & saved views ----------
CREATE TABLE public.vendor_custom_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE CHECK (key ~ '^cf_[a-z0-9_]{1,40}$'),
  label text NOT NULL CHECK (length(trim(label)) BETWEEN 1 AND 60),
  field_type text NOT NULL CHECK (field_type IN ('text','number','date','select','multi_select','checkbox','url')),
  options text[] NOT NULL DEFAULT '{}',
  sort_order int NOT NULL DEFAULT 0,
  archived_at timestamptz, archived_by uuid,
  created_by uuid DEFAULT auth.uid(), created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT, INSERT, UPDATE ON public.vendor_custom_fields TO authenticated;
GRANT ALL ON public.vendor_custom_fields TO service_role;
ALTER TABLE public.vendor_custom_fields ENABLE ROW LEVEL SECURITY;
CREATE POLICY vcf_read ON public.vendor_custom_fields FOR SELECT TO authenticated USING (private.is_staff(auth.uid()));
CREATE POLICY vcf_insert ON public.vendor_custom_fields FOR INSERT TO authenticated WITH CHECK (private.is_supervisor(auth.uid()));
CREATE POLICY vcf_update ON public.vendor_custom_fields FOR UPDATE TO authenticated USING (private.is_supervisor(auth.uid())) WITH CHECK (private.is_supervisor(auth.uid()));

CREATE TABLE public.vendor_saved_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 80),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  shared boolean NOT NULL DEFAULT false,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_saved_views TO authenticated;
GRANT ALL ON public.vendor_saved_views TO service_role;
ALTER TABLE public.vendor_saved_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY vsv_read ON public.vendor_saved_views FOR SELECT TO authenticated
  USING (private.is_staff(auth.uid()) AND (owner_id = auth.uid() OR shared));
CREATE POLICY vsv_insert ON public.vendor_saved_views FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() AND private.is_supervisor(auth.uid()));
CREATE POLICY vsv_update ON public.vendor_saved_views FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() AND private.is_supervisor(auth.uid())) WITH CHECK (owner_id = auth.uid());
CREATE POLICY vsv_delete ON public.vendor_saved_views FOR DELETE TO authenticated USING (owner_id = auth.uid());

-- Delete custom field = archive when any vendor holds a value.
CREATE OR REPLACE FUNCTION public.remove_vendor_custom_field(_field_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE f public.vendor_custom_fields; used boolean;
BEGIN
  IF NOT private.is_supervisor(auth.uid()) THEN RAISE EXCEPTION 'Only managers and supervisors can change vendor columns.'; END IF;
  SELECT * INTO f FROM public.vendor_custom_fields WHERE id = _field_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Column not found.'; END IF;
  SELECT EXISTS (SELECT 1 FROM public.vendor_orgs WHERE custom_fields ? f.key AND custom_fields->f.key <> 'null'::jsonb AND custom_fields->>f.key <> '') INTO used;
  IF used OR NOT public.has_role(auth.uid(),'admin') THEN
    UPDATE public.vendor_custom_fields SET archived_at = now(), archived_by = auth.uid() WHERE id = _field_id;
    RETURN 'archived';
  END IF;
  DELETE FROM public.vendor_custom_fields WHERE id = _field_id;
  RETURN 'deleted';
END $$;
REVOKE ALL ON FUNCTION public.remove_vendor_custom_field(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.remove_vendor_custom_field(uuid) TO authenticated;

-- ---------- Field-level audit ----------
CREATE TABLE public.vendor_field_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.vendor_orgs(id) ON DELETE CASCADE,
  field text NOT NULL, old_value jsonb, new_value jsonb,
  changed_by uuid, changed_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.vendor_field_audit TO authenticated;
GRANT ALL ON public.vendor_field_audit TO service_role;
ALTER TABLE public.vendor_field_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY vfa_read ON public.vendor_field_audit FOR SELECT TO authenticated USING (private.is_staff(auth.uid()));

-- ---------- Qualification gates (12) ----------
UPDATE public.gatekeeper_requirements SET active = false;
INSERT INTO public.gatekeeper_requirements(code,label,detail,requirement_level,verification_method,approver_role,sort_order,active) VALUES
 ('legal_identity','Legal business identity','Legal name and business entity confirmed.','blocking','Document review','manager',110,true),
 ('primary_contacts','Primary contacts','Named dispatch and escalation contacts on file.','required','Contact confirmed','manager',120,true),
 ('service_address','Service address','Business service address on file.','required','Document review','manager',130,true),
 ('w9','W-9','Signed W-9 on file.','blocking','Document review','manager',140,true),
 ('licenses','Licenses / certifications','Required trade licenses and certifications for their categories and markets.','required','License lookup','manager',150,true),
 ('insurance','Insurance','Current certificate of insurance at ARHA limits.','blocking','COI review','manager',160,true),
 ('vendor_agreement','Signed vendor agreement','ARHA vendor agreement signed.','blocking','Signed agreement','manager',170,true),
 ('written_pricing','Written pricing','Rates, markups, travel, emergency, after-hours and cancellation charges in writing.','required','Rate sheet','manager',180,true),
 ('conduct_agreement','Work-order, documentation, access, confidentiality & guest-conduct agreement','ARHA operating standards acknowledged.','blocking','Signed acknowledgment','manager',190,true),
 ('references','References','References checked.','required','Reference calls','manager',200,true),
 ('subcontractor_process','Subcontractor process','How subcontractors are vetted and disclosed.','required','Written process','manager',210,true),
 ('secure_access','Secure property/access handling','Codes, keys and access information handled securely.','required','Written process','manager',220,true)
ON CONFLICT DO NOTHING;

-- Are all active blocking gates verified & meeting (not expired)?
CREATE OR REPLACE FUNCTION private.vendor_gates_clear(_org uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.gatekeeper_requirements g
    LEFT JOIN public.vendor_gatekeeper_results r ON r.requirement_id = g.id AND r.org_id = _org
    WHERE g.active AND g.requirement_level = 'blocking'
      AND (r.id IS NULL OR r.result NOT IN ('verified_meets','not_applicable')
           OR (r.result = 'verified_meets' AND r.expires_on IS NOT NULL AND r.expires_on < current_date)))
$$;

-- ---------- Guard + audit trigger ----------
CREATE OR REPLACE FUNCTION private.vendor_orgs_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); is_admin boolean; is_lead boolean; is_sup boolean; is_staff boolean;
  k text; o jsonb; n jsonb;
  system_cols text[] := ARRAY['dispatch_method','breezeway_person_id','source_system','legacy_notion_id','migration_status','legacy_fields','created_by','created_at'];
  gold_cols text[] := ARRAY['status','compliance_status','score_capacity','score_responsiveness','score_quality','score_hospitality','score_communication','score_pricing','score_references','performance_score','jobs_90d','critical_failure','last_review_on','next_review_on','program_owner','open_corrective_action','corrective_action_due','tier','trial_score'];
  skip_cols text[] := ARRAY['updated_at','qualification_score'];
BEGIN
  IF uid IS NULL THEN RETURN NEW; END IF; -- service role / system jobs
  is_admin := public.has_role(uid,'admin');
  is_lead := is_admin OR private.is_director(uid);
  is_sup := is_lead OR private.is_supervisor(uid);
  is_staff := private.is_staff(uid);
  o := to_jsonb(OLD); n := to_jsonb(NEW);
  FOR k IN SELECT jsonb_object_keys(n) LOOP
    IF k = ANY(skip_cols) OR (o->k) IS NOT DISTINCT FROM (n->k) THEN CONTINUE; END IF;
    IF k = ANY(system_cols) AND NOT is_lead THEN
      RAISE EXCEPTION 'The % field is a protected system field. Only Admin or the Director of Operations can change it.', k;
    END IF;
    IF k = ANY(gold_cols) AND NOT is_sup THEN
      RAISE EXCEPTION 'Only Operations leadership can change Gold Standard or compliance fields.';
    END IF;
    IF NOT is_staff AND k NOT IN ('primary_contact_name','primary_contact_email','primary_contact_phone','website','notes') THEN
      RAISE EXCEPTION 'Vendor accounts can only update their contact details.';
    END IF;
    INSERT INTO public.vendor_field_audit(org_id, field, old_value, new_value, changed_by)
      VALUES (NEW.id, k, o->k, n->k, uid);
  END LOOP;
  IF NEW.status IN ('approved','gold') AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT private.vendor_gates_clear(NEW.id) THEN
      RAISE EXCEPTION 'A required qualification gate is not complete. A score cannot override a failed gate.';
    END IF;
    IF NEW.critical_failure THEN
      RAISE EXCEPTION 'This vendor has an open critical failure and cannot be Approved or Gold.';
    END IF;
  END IF;
  NEW.is_active := NEW.status <> 'inactive' AND NEW.is_active;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_vendor_orgs_guard BEFORE UPDATE ON public.vendor_orgs
  FOR EACH ROW EXECUTE FUNCTION private.vendor_orgs_guard();

-- ---------- Notion migration staging ----------
ALTER TABLE public.vendor_import_rows
  ADD COLUMN source_system text NOT NULL DEFAULT 'breezeway',
  ADD COLUMN company text, ADD COLUMN contact_person text, ADD COLUMN markets text[] NOT NULL DEFAULT '{}',
  ADD COLUMN specialties text[] NOT NULL DEFAULT '{}', ADD COLUMN preference text, ADD COLUMN website text,
  ADD COLUMN pricing text, ADD COLUMN comments text, ADD COLUMN payment_type text,
  ADD COLUMN breezeway_hint boolean, ADD COLUMN legacy_status text, ADD COLUMN tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN legacy_notion_id text, ADD COLUMN legacy_fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN review_states text[] NOT NULL DEFAULT '{}',
  ADD COLUMN duplicate_candidates uuid[] NOT NULL DEFAULT '{}';

-- ---------- Guided ticket ----------
ALTER TABLE public.tickets
  ADD COLUMN resolution_path text CHECK (resolution_path IN ('guest','field','escalate','already_resolved')),
  ADD COLUMN resolution_path_at timestamptz,
  ADD COLUMN resolution_path_by uuid,
  ADD COLUMN guest_update_at timestamptz,
  ADD COLUMN guest_update_note text,
  ADD COLUMN next_guest_update_at timestamptz,
  ADD COLUMN selected_vendor_org_id uuid REFERENCES public.vendor_orgs(id);

CREATE TABLE public.troubleshooting_guides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL, title text NOT NULL, active boolean NOT NULL DEFAULT true,
  created_by uuid DEFAULT auth.uid(), created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.troubleshooting_guide_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guide_id uuid NOT NULL REFERENCES public.troubleshooting_guides(id) ON DELETE CASCADE,
  position int NOT NULL, prompt text NOT NULL, help text,
  UNIQUE (guide_id, position));
CREATE TABLE public.ticket_troubleshooting_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  step_id uuid NOT NULL REFERENCES public.troubleshooting_guide_steps(id),
  outcome text NOT NULL CHECK (outcome IN ('fixed','not_fixed','skipped')),
  note text, answered_by uuid NOT NULL DEFAULT auth.uid(), answered_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT, INSERT, UPDATE ON public.troubleshooting_guides, public.troubleshooting_guide_steps TO authenticated;
GRANT SELECT, INSERT ON public.ticket_troubleshooting_answers TO authenticated;
GRANT ALL ON public.troubleshooting_guides, public.troubleshooting_guide_steps, public.ticket_troubleshooting_answers TO service_role;
ALTER TABLE public.troubleshooting_guides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.troubleshooting_guide_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_troubleshooting_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY tg_read ON public.troubleshooting_guides FOR SELECT TO authenticated USING (private.is_staff(auth.uid()));
CREATE POLICY tg_write ON public.troubleshooting_guides FOR ALL TO authenticated USING (private.is_supervisor(auth.uid())) WITH CHECK (private.is_supervisor(auth.uid()));
CREATE POLICY tgs_read ON public.troubleshooting_guide_steps FOR SELECT TO authenticated USING (private.is_staff(auth.uid()));
CREATE POLICY tgs_write ON public.troubleshooting_guide_steps FOR ALL TO authenticated USING (private.is_supervisor(auth.uid())) WITH CHECK (private.is_supervisor(auth.uid()));
CREATE POLICY tta_read ON public.ticket_troubleshooting_answers FOR SELECT TO authenticated USING (private.is_staff(auth.uid()));
CREATE POLICY tta_insert ON public.ticket_troubleshooting_answers FOR INSERT TO authenticated
  WITH CHECK (answered_by = auth.uid() AND private.is_staff(auth.uid()));
