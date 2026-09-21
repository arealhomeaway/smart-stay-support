ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE public.claims ADD COLUMN IF NOT EXISTS category text;

COMMENT ON COLUMN public.work_orders.category IS 'Shared operational category (see src/lib/taxonomy.ts). Derived from service_category trade.';
COMMENT ON COLUMN public.claims.category IS 'Shared operational category (see src/lib/taxonomy.ts) describing the work that caused the loss.';

UPDATE public.work_orders SET category = CASE
  WHEN lower(coalesce(service_category,'')) IN ('cleaning','housekeeping','trash valet') THEN 'cleaning'
  WHEN lower(coalesce(service_category,'')) IN ('locks & access','locks and access','locksmith') THEN 'access'
  WHEN lower(coalesce(service_category,'')) IN ('photography') THEN 'admin'
  WHEN lower(coalesce(service_category,'')) IN ('smoke','co','safety devices') THEN 'safety'
  WHEN coalesce(service_category,'') = '' THEN 'other'
  ELSE 'maintenance' END
WHERE category IS NULL;

UPDATE public.claims c SET category = coalesce(
  (SELECT t.category FROM public.tickets t WHERE t.id = c.ticket_id), 'claims')
WHERE c.category IS NULL;