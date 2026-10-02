-- One live linked Ticket per feedback record per kind (Ops / Maintenance).
CREATE UNIQUE INDEX IF NOT EXISTS tickets_linked_feedback_once
  ON public.tickets (linked_feedback_id, entry_kind)
  WHERE linked_feedback_id IS NOT NULL AND archived_at IS NULL;