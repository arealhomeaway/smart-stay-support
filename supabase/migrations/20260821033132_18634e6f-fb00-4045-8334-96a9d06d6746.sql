CREATE TABLE public.vendor_job_ratings (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  vendor_user_id uuid not null references auth.users(id) on delete cascade,
  rated_by uuid references auth.users(id),
  thoroughness smallint not null,
  communication smallint not null,
  timeliness smallint not null,
  photos_complete boolean not null default false,
  reopened boolean not null default false,
  on_time boolean not null default true,
  note text,
  points integer not null default 0,
  overall numeric(4,2) not null default 0,
  created_at timestamptz not null default now(),
  unique (ticket_id)
);

CREATE INDEX vendor_job_ratings_vendor_idx ON public.vendor_job_ratings(vendor_user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_job_ratings TO authenticated;
GRANT ALL ON public.vendor_job_ratings TO service_role;

ALTER TABLE public.vendor_job_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage vendor ratings" ON public.vendor_job_ratings
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Vendors read their own ratings" ON public.vendor_job_ratings
  FOR SELECT TO authenticated
  USING (vendor_user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.validate_vendor_rating()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.thoroughness NOT BETWEEN 1 AND 5
     OR NEW.communication NOT BETWEEN 1 AND 5
     OR NEW.timeliness NOT BETWEEN 1 AND 5 THEN
    RAISE EXCEPTION 'Ratings must be between 1 and 5';
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER vendor_job_ratings_validate
BEFORE INSERT OR UPDATE ON public.vendor_job_ratings
FOR EACH ROW EXECUTE FUNCTION public.validate_vendor_rating();