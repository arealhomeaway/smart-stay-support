-- Proactive expiration reminders for Must Pass credentials that carry an
-- expiration date (Insurance, Licences/Certifications). Internal only.
CREATE TABLE public.vendor_compliance_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.vendor_orgs(id) ON DELETE CASCADE,
  requirement_id uuid NOT NULL REFERENCES public.gatekeeper_requirements(id) ON DELETE CASCADE,
  compliance_item text NOT NULL,
  threshold text NOT NULL CHECK (threshold IN ('30_days','14_days','7_days','expiration_day')),
  expires_on date NOT NULL,
  notified_at timestamptz NOT NULL DEFAULT now(),
  recipients uuid[] NOT NULL DEFAULT '{}',
  is_demo boolean NOT NULL DEFAULT false,
  resolved_at timestamptz,
  resolution text CHECK (resolution IS NULL OR resolution IN ('renewed','restored','cleared')),
  UNIQUE (org_id, requirement_id, expires_on, threshold)
);
CREATE INDEX vendor_compliance_reminders_open_idx ON public.vendor_compliance_reminders (org_id) WHERE resolved_at IS NULL;

GRANT SELECT ON public.vendor_compliance_reminders TO authenticated;
GRANT ALL ON public.vendor_compliance_reminders TO service_role;
ALTER TABLE public.vendor_compliance_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read compliance reminders" ON public.vendor_compliance_reminders
  FOR SELECT TO authenticated USING (private.is_staff(auth.uid()));

-- Which reminder stage a credential is in today (NULL = none due).
CREATE OR REPLACE FUNCTION public.vendor_compliance_threshold(_expires date, _today date DEFAULT current_date)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN _expires IS NULL OR _expires < _today THEN NULL
    WHEN _expires = _today THEN 'expiration_day'
    WHEN _expires - _today <= 7 THEN '7_days'
    WHEN _expires - _today <= 14 THEN '14_days'
    WHEN _expires - _today <= 30 THEN '30_days'
    ELSE NULL END
$$;

-- The pass: one reminder per credential, expiration date and stage; it never
-- repeats a stage and never backfills an earlier stage it slept through.
CREATE OR REPLACE FUNCTION public.vendor_compliance_sweep(_today date DEFAULT current_date)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r record; _id uuid; _recipients uuid[]; _u uuid; _created int := 0; _resolved int := 0;
  _title text; _body text; _label text;
BEGIN
  -- Close reminders whose credential was renewed or is no longer on record.
  WITH closed AS (
    UPDATE public.vendor_compliance_reminders m
       SET resolved_at = now(),
           resolution = CASE WHEN g.id IS NULL THEN 'cleared'
                             WHEN g.expires_on > m.expires_on THEN 'renewed' ELSE 'cleared' END
      FROM public.vendor_compliance_reminders m2
      LEFT JOIN public.vendor_gatekeeper_results g
        ON g.org_id = m2.org_id AND g.requirement_id = m2.requirement_id
     WHERE m.id = m2.id AND m.resolved_at IS NULL
       AND (g.id IS NULL OR g.expires_on IS DISTINCT FROM m.expires_on
            OR g.result NOT IN ('verified_meets','equivalent_verified'))
    RETURNING 1)
  SELECT count(*) INTO _resolved FROM closed;

  FOR r IN
    SELECT g.org_id, g.requirement_id, g.expires_on, q.label, v.display_name, v.program_owner, v.is_demo,
           public.vendor_compliance_threshold(g.expires_on, _today) AS threshold
      FROM public.vendor_gatekeeper_results g
      JOIN public.gatekeeper_requirements q ON q.id = g.requirement_id AND q.active AND q.expiry_required
      JOIN public.vendor_orgs v ON v.id = g.org_id
     WHERE g.result IN ('verified_meets','equivalent_verified')
       AND public.vendor_compliance_threshold(g.expires_on, _today) IS NOT NULL
  LOOP
    SELECT array_agg(DISTINCT u) INTO _recipients FROM (
      SELECT ur.user_id AS u FROM public.user_roles ur WHERE ur.role = 'admin'
      UNION SELECT fr.current_seat_holder FROM public.functional_roles fr
             WHERE fr.code = 'director_ops' AND fr.current_seat_holder IS NOT NULL
      UNION SELECT m.user_id FROM public.functional_role_members m WHERE m.role_code = 'director_ops'
      UNION SELECT r.program_owner WHERE r.program_owner IS NOT NULL
    ) s WHERE u IS NOT NULL;

    INSERT INTO public.vendor_compliance_reminders
      (org_id, requirement_id, compliance_item, threshold, expires_on, recipients, is_demo)
    VALUES (r.org_id, r.requirement_id, r.label, r.threshold, r.expires_on, coalesce(_recipients,'{}'), r.is_demo)
    ON CONFLICT (org_id, requirement_id, expires_on, threshold) DO NOTHING
    RETURNING id INTO _id;
    CONTINUE WHEN _id IS NULL;
    _created := _created + 1;

    _label := CASE r.threshold WHEN 'expiration_day' THEN 'expires today'
      WHEN '7_days' THEN 'expires in ' || (r.expires_on - _today) || ' day' || CASE WHEN r.expires_on - _today = 1 THEN '' ELSE 's' END
      ELSE 'expires ' || to_char(r.expires_on, 'FMMM/FMDD/YYYY') END;
    _title := r.display_name || ': ' || r.label || ' ' || _label;
    _body := CASE WHEN r.threshold = 'expiration_day'
      THEN 'Last valid day. From tomorrow this vendor goes On Hold and cannot be chosen for new work until updated proof is recorded.'
      ELSE 'Still valid, so the vendor can be used. Collect updated proof before ' || to_char(r.expires_on, 'FMMM/FMDD/YYYY') || ' to avoid a hold.' END;

    FOREACH _u IN ARRAY coalesce(_recipients,'{}') LOOP
      PERFORM public.notify_staff(_u, 'vendor_compliance_' || r.threshold, _title, _body,
        'vendor', r.org_id, '/vendors/' || r.org_id || '?gate=' || r.requirement_id,
        CASE WHEN r.threshold IN ('7_days','expiration_day') THEN 'urgent' ELSE 'normal' END,
        NULL, false, r.is_demo);
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object('created', _created, 'resolved', _resolved);
END $$;

REVOKE ALL ON FUNCTION public.vendor_compliance_sweep(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vendor_compliance_sweep(date) TO service_role;
GRANT EXECUTE ON FUNCTION public.vendor_compliance_threshold(date, date) TO authenticated, service_role;