ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS breezeway_mapping_state text NOT NULL DEFAULT 'unmapped',
  ADD COLUMN IF NOT EXISTS breezeway_mapping_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS breezeway_mapping_note text;

ALTER TABLE public.properties
  DROP CONSTRAINT IF EXISTS properties_breezeway_mapping_state_check;
ALTER TABLE public.properties
  ADD CONSTRAINT properties_breezeway_mapping_state_check
  CHECK (breezeway_mapping_state IN ('verified','unmapped','ambiguous','inactive','excluded'));

CREATE TABLE IF NOT EXISTS public.breezeway_work_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  breezeway_task_id bigint NOT NULL UNIQUE,
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  breezeway_home_id text NOT NULL,
  name text,
  description text,
  department text,
  priority text,
  status text,
  stage text,
  scheduled_date date,
  scheduled_time text,
  assignees jsonb NOT NULL DEFAULT '[]'::jsonb,
  photo_count integer NOT NULL DEFAULT 0,
  comment_count integer NOT NULL DEFAULT 0,
  linked_ticket_id uuid REFERENCES public.tickets(id) ON DELETE SET NULL,
  needs_attention boolean NOT NULL DEFAULT false,
  breezeway_created_at timestamptz,
  breezeway_updated_at timestamptz,
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS breezeway_work_orders_property_idx ON public.breezeway_work_orders(property_id);
CREATE INDEX IF NOT EXISTS breezeway_work_orders_ticket_idx ON public.breezeway_work_orders(linked_ticket_id);

CREATE TABLE IF NOT EXISTS public.breezeway_work_order_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL REFERENCES public.breezeway_work_orders(id) ON DELETE CASCADE,
  breezeway_task_id bigint NOT NULL,
  breezeway_comment_id bigint,
  author text,
  body text NOT NULL,
  commented_at timestamptz,
  direction text NOT NULL DEFAULT 'inbound',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT breezeway_comment_direction_check CHECK (direction IN ('inbound','outbound'))
);

CREATE UNIQUE INDEX IF NOT EXISTS breezeway_work_order_comments_external_uniq
  ON public.breezeway_work_order_comments(breezeway_comment_id)
  WHERE breezeway_comment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS breezeway_work_order_comments_wo_idx
  ON public.breezeway_work_order_comments(work_order_id);

GRANT SELECT ON public.breezeway_work_orders TO authenticated;
GRANT ALL ON public.breezeway_work_orders TO service_role;
GRANT SELECT ON public.breezeway_work_order_comments TO authenticated;
GRANT ALL ON public.breezeway_work_order_comments TO service_role;

ALTER TABLE public.breezeway_work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.breezeway_work_order_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view Breezeway work orders" ON public.breezeway_work_orders;
CREATE POLICY "Staff can view Breezeway work orders"
  ON public.breezeway_work_orders FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff can view Breezeway work order comments" ON public.breezeway_work_order_comments;
CREATE POLICY "Staff can view Breezeway work order comments"
  ON public.breezeway_work_order_comments FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

DROP TRIGGER IF EXISTS breezeway_work_orders_updated_at ON public.breezeway_work_orders;
CREATE TRIGGER breezeway_work_orders_updated_at
  BEFORE UPDATE ON public.breezeway_work_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();