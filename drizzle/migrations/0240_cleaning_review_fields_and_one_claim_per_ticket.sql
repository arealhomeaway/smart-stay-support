ALTER TABLE public.cleaning_reviews ADD COLUMN IF NOT EXISTS bill_guest boolean;
ALTER TABLE public.cleaning_reviews ADD COLUMN IF NOT EXISTS guest_paid_deposit boolean;
COMMENT ON COLUMN public.cleaning_reviews.bill_guest IS 'Will we need to bill the guest (Fillout Cleaning Review). Damage checklist and deposit amount live on departure_reviews.';
COMMENT ON COLUMN public.cleaning_reviews.guest_paid_deposit IS 'Did the guest pay a deposit (Fillout Cleaning Review).';
CREATE UNIQUE INDEX IF NOT EXISTS claims_one_per_ticket ON public.claims (ticket_id) WHERE ticket_id IS NOT NULL;