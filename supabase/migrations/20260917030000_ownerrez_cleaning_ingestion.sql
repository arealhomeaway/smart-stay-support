-- UNAPPLIED. Requires 20260917020000_operations_cleaning_foundation.sql and isolated staging review.
-- No OwnerRez connection, job, webhook endpoint or external delivery is created here.

ALTER TABLE public.cleaning_turnovers
  ADD COLUMN ownerrez_property_id text,
  ADD COLUMN reservation_status text,
  ADD COLUMN arrival_at timestamptz,
  ADD COLUMN checkout_at timestamptz,
  ADD COLUMN guest_identity_ref text,
  ADD COLUMN booking_channel text,
  ADD COLUMN last_synchronized_at timestamptz;
CREATE UNIQUE INDEX cleaning_turnovers_ownerrez_booking_unique ON public.cleaning_turnovers(reservation_external_ref);

ALTER TABLE public.cleaning_tasks
  ADD COLUMN cleaner_eligibility_id uuid,
  ADD COLUMN assignment_route text CHECK (assignment_route IN ('property_default','market_fallback','unassigned')),
  ADD COLUMN assignment_at_risk boolean NOT NULL DEFAULT false,
  ADD COLUMN acceptance_deadline_at timestamptz;
ALTER TABLE public.cleaning_task_events ALTER COLUMN actor_id DROP NOT NULL;
ALTER TABLE public.cleaning_task_events ADD COLUMN source_system text;
ALTER TABLE public.cleaning_task_events ADD COLUMN source_event_id text;

CREATE TABLE public.cleaner_eligibility (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  internal_user_id uuid REFERENCES auth.users(id),
  external_vendor_org_id uuid REFERENCES public.vendor_orgs(id),
  eligible_markets text[] NOT NULL DEFAULT '{}',
  eligible_property_ids uuid[] NOT NULL DEFAULT '{}',
  service_types text[] NOT NULL DEFAULT '{}',
  default_property_ids uuid[] NOT NULL DEFAULT '{}',
  backup_priority integer NOT NULL DEFAULT 100 CHECK (backup_priority >= 0),
  blackout_until timestamptz,
  acceptance_required boolean NOT NULL DEFAULT true,
  acceptance_window interval,
  contact_delivery_method text,
  effective_from timestamptz,
  effective_to timestamptz,
  source_system text NOT NULL,
  source_reference text,
  verification_status text NOT NULL DEFAULT 'NEEDS VERIFICATION'
    CHECK (verification_status IN ('VERIFIED','NEEDS VERIFICATION')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (internal_user_id IS NOT NULL OR external_vendor_org_id IS NOT NULL),
  CHECK (effective_to IS NULL OR effective_from IS NULL OR effective_to >= effective_from)
);
ALTER TABLE public.cleaning_tasks ADD CONSTRAINT cleaning_tasks_eligibility_fk
  FOREIGN KEY (cleaner_eligibility_id) REFERENCES public.cleaner_eligibility(id);

CREATE TABLE public.ownerrez_checkout_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ownerrez_booking_id text NOT NULL,
  ownerrez_property_id text NOT NULL,
  reservation_status text NOT NULL,
  arrival_at timestamptz NOT NULL,
  checkout_at timestamptz NOT NULL,
  guest_identity_ref text,
  booking_channel text,
  event_source text NOT NULL CHECK (event_source IN ('webhook','poll')),
  source_event_id text,
  idempotency_key text NOT NULL UNIQUE,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_synchronized_at timestamptz NOT NULL DEFAULT now(),
  source_payload_version_or_hash text NOT NULL,
  processing_result text NOT NULL DEFAULT 'pending',
  error_state text,
  turnover_id uuid REFERENCES public.cleaning_turnovers(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ownerrez_checkout_booking_idx ON public.ownerrez_checkout_events(ownerrez_booking_id,first_seen_at DESC);

CREATE TABLE public.cleaning_scheduling_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  turnover_id uuid NOT NULL REFERENCES public.cleaning_turnovers(id),
  source_event_id uuid NOT NULL REFERENCES public.ownerrez_checkout_events(id),
  reason text NOT NULL,
  previous_checkout_at timestamptz,
  proposed_checkout_at timestamptz,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
  resolved_by uuid REFERENCES auth.users(id),
  resolved_at timestamptz,
  resolution_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_event_id)
);

CREATE TABLE public.cleaning_checklist_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_ref_id uuid NOT NULL REFERENCES public.cleaning_template_refs(id),
  version text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','james_review','micah_approval','approved','retired')),
  source_sha256 text NOT NULL,
  effective_from timestamptz,
  approved_by uuid REFERENCES auth.users(id),
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (template_ref_id,version),
  CHECK (status <> 'approved' OR (approved_by IS NOT NULL AND approved_at IS NOT NULL AND effective_from IS NOT NULL))
);
CREATE TABLE public.cleaning_checklist_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_version_id uuid NOT NULL REFERENCES public.cleaning_checklist_versions(id),
  source_paragraph integer NOT NULL,
  section_name text NOT NULL,
  field_key text NOT NULL,
  instruction text NOT NULL,
  classification text NOT NULL CHECK (classification IN
    ('executable_field','instructional_text','conditional_rule','evidence_requirement',
     'supply_par_requirement','issue_generation_rule','property_specific_exception',
     'duplicate','legacy','needs_decision')),
  response_type text,
  required boolean,
  conditional_rule jsonb,
  photo_required boolean,
  other_evidence_required text,
  failure_behavior text,
  follow_up_issue_behavior text,
  market_scope text,
  property_id uuid REFERENCES public.properties(id),
  sort_order integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (checklist_version_id,source_paragraph),
  UNIQUE (checklist_version_id,field_key)
);

CREATE TABLE public.cleaning_billing_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES public.cleaning_reviews(id),
  finding_id uuid REFERENCES public.cleaning_review_findings(id),
  decision text NOT NULL CHECK (decision IN ('bill_guest','do_not_bill','hold_for_review','apply_deposit','no_deposit_action')),
  amount numeric(12,2) CHECK (amount >= 0),
  reason text NOT NULL CHECK (length(trim(reason)) > 0),
  decided_by uuid NOT NULL REFERENCES auth.users(id),
  decided_at timestamptz NOT NULL DEFAULT now(),
  supporting_evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  delivery_state text NOT NULL DEFAULT 'not_sent' CHECK (delivery_state = 'not_sent')
);

-- Conservative RLS. This migration grants no task writes to browsers and no vendor/owner access.
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['cleaner_eligibility','ownerrez_checkout_events',
  'cleaning_scheduling_exceptions','cleaning_checklist_versions',
  'cleaning_checklist_fields','cleaning_billing_decisions'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('GRANT SELECT ON public.%I TO authenticated',t);
  EXECUTE format('GRANT ALL ON public.%I TO service_role',t);
  EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (private.is_staff(auth.uid()))',t||'_staff_read',t);
 END LOOP;
END $$;

-- Transactional ingestion boundary. service_role only; callers must authenticate
-- and verify OwnerRez upstream. This function never calls OwnerRez or delivers mail.
CREATE OR REPLACE FUNCTION private.ingest_ownerrez_checkout(_event jsonb, _event_source text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  booking text := nullif(trim(_event->>'bookingId'),'');
  ownerrez_property text := nullif(trim(_event->>'ownerrezPropertyId'),'');
  payload_version text := nullif(trim(_event->>'payloadVersionOrHash'),'');
  source_id text := nullif(trim(_event->>'sourceEventId'),'');
  event_key text;
  arrival_time timestamptz;
  checkout_time timestamptz;
  event_row public.ownerrez_checkout_events%ROWTYPE;
  property_row public.properties%ROWTYPE;
  turnover_row public.cleaning_turnovers%ROWTYPE;
  task_row public.cleaning_tasks%ROWTYPE;
  template_row public.cleaning_template_refs%ROWTYPE;
  cleaner_row public.cleaner_eligibility%ROWTYPE;
  outcome text;
BEGIN
  IF booking IS NULL OR ownerrez_property IS NULL OR payload_version IS NULL OR _event_source NOT IN ('webhook','poll') THEN
    RAISE EXCEPTION 'OwnerRez checkout identity or source is invalid';
  END IF;
  arrival_time := (_event->>'arrivalAt')::timestamptz;
  checkout_time := (_event->>'checkoutAt')::timestamptz;
  IF checkout_time <= arrival_time THEN RAISE EXCEPTION 'OwnerRez checkout must follow arrival'; END IF;
  event_key := CASE WHEN source_id IS NOT NULL THEN 'event:'||source_id
    ELSE 'booking:'||ownerrez_property||':'||booking||':snapshot:'||md5(_event::text) END;
  PERFORM pg_advisory_xact_lock(hashtextextended(booking,0));
  INSERT INTO public.ownerrez_checkout_events
    (ownerrez_booking_id,ownerrez_property_id,reservation_status,arrival_at,checkout_at,
     guest_identity_ref,booking_channel,event_source,source_event_id,idempotency_key,source_payload_version_or_hash)
  VALUES (booking,ownerrez_property,_event->>'reservationStatus',arrival_time,checkout_time,
          _event->>'guestIdentityRef',_event->>'bookingChannel',_event_source,source_id,event_key,payload_version)
  ON CONFLICT (idempotency_key) DO UPDATE SET last_synchronized_at=now()
  RETURNING * INTO event_row;
  IF event_row.processing_result NOT IN ('pending','error') THEN
    RETURN jsonb_build_object('result','duplicate_event','turnover_id',event_row.turnover_id);
  END IF;

  -- A nested block preserves the event ledger row when processing fails.
  BEGIN
  SELECT * INTO property_row FROM public.properties
   WHERE ownerrez_property_id=ownerrez_property AND NOT coalesce(is_demo,false) FOR UPDATE;
  IF NOT FOUND OR property_row.market IS NULL THEN
    UPDATE public.ownerrez_checkout_events SET processing_result='error',
      error_state='No mapped non-demo Resolve property with canonical market' WHERE id=event_row.id;
    RETURN jsonb_build_object('result','error','reason','property_or_market_not_mapped');
  END IF;
  SELECT * INTO turnover_row FROM public.cleaning_turnovers WHERE reservation_external_ref=booking FOR UPDATE;
  IF FOUND AND turnover_row.property_id <> property_row.id THEN
    INSERT INTO public.cleaning_scheduling_exceptions
      (turnover_id,source_event_id,reason,previous_checkout_at,proposed_checkout_at)
    VALUES (turnover_row.id,event_row.id,'OwnerRez booking moved to another property',turnover_row.checkout_at,checkout_time)
    ON CONFLICT (source_event_id) DO NOTHING;
    outcome := 'scheduling_exception';
  ELSIF NOT FOUND AND _event->>'reservationStatus'='cancelled' THEN
    outcome := 'ignored_cancelled';
  ELSIF NOT FOUND THEN
    SELECT * INTO template_row FROM public.cleaning_template_refs
      WHERE external_template_id=CASE WHEN upper(property_row.market)='OKC' THEN 581109 ELSE 581110 END
        AND classification='active';
    INSERT INTO public.cleaning_turnovers
      (property_id,reservation_external_ref,official_checkout_date,ownerrez_booking_ref,
       ownerrez_property_id,reservation_status,arrival_at,checkout_at,guest_identity_ref,
       booking_channel,last_synchronized_at,departure_template_ref_id)
    VALUES (property_row.id,booking,left(_event->>'checkoutAt',10)::date,booking,
            ownerrez_property,_event->>'reservationStatus',arrival_time,checkout_time,
            _event->>'guestIdentityRef',_event->>'bookingChannel',now(),template_row.id)
    RETURNING * INTO turnover_row;
    SELECT * INTO cleaner_row FROM public.cleaner_eligibility c
      WHERE c.active AND c.verification_status='VERIFIED'
        AND property_row.market=ANY(c.eligible_markets)
        AND 'departure'=ANY(c.service_types)
        AND (cardinality(c.eligible_property_ids)=0 OR property_row.id=ANY(c.eligible_property_ids))
        AND (c.blackout_until IS NULL OR c.blackout_until<checkout_time)
        AND (c.effective_from IS NULL OR c.effective_from<=checkout_time)
        AND (c.effective_to IS NULL OR c.effective_to>=checkout_time)
      ORDER BY CASE WHEN property_row.id=ANY(c.default_property_ids) THEN 0 ELSE 1 END,
               c.backup_priority,c.id LIMIT 1;
    INSERT INTO public.cleaning_tasks
      (turnover_id,property_id,template_ref_id,task_kind,state,assigned_user_id,
       assigned_vendor_org_id,cleaner_eligibility_id,assignment_route,assignment_at_risk,
       acceptance_deadline_at,scheduled_for,checklist_version)
    VALUES (turnover_row.id,property_row.id,template_row.id,'departure',
      CASE WHEN cleaner_row.id IS NULL THEN 'scheduled' WHEN cleaner_row.acceptance_required THEN 'offered' ELSE 'accepted' END,
      cleaner_row.internal_user_id,cleaner_row.external_vendor_org_id,cleaner_row.id,
      CASE WHEN cleaner_row.id IS NULL THEN 'unassigned'
           WHEN property_row.id=ANY(cleaner_row.default_property_ids) THEN 'property_default'
           ELSE 'market_fallback' END,
      cleaner_row.id IS NULL,
      CASE WHEN cleaner_row.acceptance_required AND cleaner_row.acceptance_window IS NOT NULL
           THEN now()+cleaner_row.acceptance_window ELSE NULL END,
      checkout_time,template_row.checklist_version)
    RETURNING * INTO task_row;
    INSERT INTO public.cleaning_task_events
      (task_id,event_kind,to_state,assigned_user_id,assigned_vendor_org_id,
       comment,source_system,source_event_id)
    VALUES (task_row.id,'ownerrez_turnover_created',task_row.state,
      task_row.assigned_user_id,task_row.assigned_vendor_org_id,
      CASE WHEN cleaner_row.id IS NULL THEN 'Unassigned; Operations dispatch needed'
           ELSE 'Routed from verified cleaner eligibility' END,'ownerrez',event_key);
    outcome := CASE WHEN cleaner_row.id IS NULL THEN 'created_unassigned' ELSE 'created_assigned' END;
  ELSE
    SELECT * INTO task_row FROM public.cleaning_tasks
      WHERE turnover_id=turnover_row.id AND task_kind='departure' AND state<>'closed_cancelled' FOR UPDATE;
    IF task_row.id IS NULL THEN
      INSERT INTO public.cleaning_scheduling_exceptions
        (turnover_id,source_event_id,reason,previous_checkout_at,proposed_checkout_at)
      VALUES (turnover_row.id,event_row.id,'Existing turnover has no active departure task',turnover_row.checkout_at,checkout_time)
      ON CONFLICT (source_event_id) DO NOTHING;
      outcome := 'scheduling_exception';
    ELSIF _event->>'reservationStatus'='cancelled' OR
       (turnover_row.checkout_at IS DISTINCT FROM checkout_time AND
        (task_row.state IS DISTINCT FROM 'scheduled' OR EXISTS
         (SELECT 1 FROM public.cleaning_checklist_answers WHERE task_id=task_row.id))) THEN
      INSERT INTO public.cleaning_scheduling_exceptions
        (turnover_id,source_event_id,reason,previous_checkout_at,proposed_checkout_at)
      VALUES (turnover_row.id,event_row.id,'Reservation changed after task assignment or evidence',turnover_row.checkout_at,checkout_time)
      ON CONFLICT (source_event_id) DO NOTHING;
      outcome := 'scheduling_exception';
    ELSIF turnover_row.checkout_at IS DISTINCT FROM checkout_time THEN
      UPDATE public.cleaning_turnovers SET official_checkout_date=left(_event->>'checkoutAt',10)::date,
        reservation_status=_event->>'reservationStatus',arrival_at=arrival_time,checkout_at=checkout_time,
        guest_identity_ref=_event->>'guestIdentityRef',booking_channel=_event->>'bookingChannel',
        last_synchronized_at=now() WHERE id=turnover_row.id;
      UPDATE public.cleaning_tasks SET scheduled_for=checkout_time,updated_at=now() WHERE id=task_row.id;
      INSERT INTO public.cleaning_task_events
        (task_id,event_kind,from_state,to_state,comment,source_system,source_event_id)
      VALUES (task_row.id,'ownerrez_rescheduled',task_row.state,task_row.state,
        'Checkout time changed from '||turnover_row.checkout_at||' to '||checkout_time,'ownerrez',event_key);
      outcome := 'rescheduled';
    ELSE
      UPDATE public.cleaning_turnovers SET reservation_status=_event->>'reservationStatus',
        arrival_at=arrival_time,guest_identity_ref=_event->>'guestIdentityRef',
        booking_channel=_event->>'bookingChannel',last_synchronized_at=now() WHERE id=turnover_row.id;
      outcome := 'unchanged';
    END IF;
  END IF;
  UPDATE public.ownerrez_checkout_events SET processing_result=outcome,error_state=NULL,
    turnover_id=turnover_row.id,last_synchronized_at=now() WHERE id=event_row.id;
  RETURN jsonb_build_object('result',outcome,'turnover_id',turnover_row.id);
EXCEPTION WHEN OTHERS THEN
  UPDATE public.ownerrez_checkout_events SET processing_result='error',error_state=SQLERRM,
    last_synchronized_at=now() WHERE id=event_row.id;
  RETURN jsonb_build_object('result','error','reason',SQLERRM);
  END;
END $$;
REVOKE ALL ON FUNCTION private.ingest_ownerrez_checkout(jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.ingest_ownerrez_checkout(jsonb,text) TO service_role;
