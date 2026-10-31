-- Restores the Linder 25-hour checkpoint card to its before-row (see before-row.json).
UPDATE public.owner_contact_alerts SET status='pending', handled_by=NULL, handled_at=NULL, handled_note=NULL
WHERE id='9cd516b3-f873-479f-acb0-b29878528eb0';
