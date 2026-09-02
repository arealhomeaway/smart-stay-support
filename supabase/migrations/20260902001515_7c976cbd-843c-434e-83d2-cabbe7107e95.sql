ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS reservation_guest_name text,
  ADD COLUMN IF NOT EXISTS reservation_channel text,
  ADD COLUMN IF NOT EXISTS reservation_confirmation text,
  ADD COLUMN IF NOT EXISTS reservation_arrival date,
  ADD COLUMN IF NOT EXISTS reservation_departure date,
  ADD COLUMN IF NOT EXISTS reservation_guest_count integer,
  ADD COLUMN IF NOT EXISTS reservation_url text,
  ADD COLUMN IF NOT EXISTS reservation_snapshot_at timestamptz;

COMMENT ON COLUMN public.tickets.reservation_snapshot_at IS
  'When the OwnerRez reservation context was frozen onto this ticket. OwnerRez remains authoritative for the reservation itself; these columns are a ticket-time snapshot for operational context only.';

COMMENT ON TABLE public.property_owner_contacts IS
  'OBSOLETE / transitional (2026-09-02). Owner context now reads the canonical properties.owner_record_id -> public.property_owners relationship. Retained empty for historical reference; no Resolve read path depends on it.';