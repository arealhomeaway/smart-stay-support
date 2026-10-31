-- Data change (run through the data tool, not a migration).
-- Closes the 7 real-home call/text items caused by activities withdrawn on Oct 29.
-- Guarded: touches only these ids and only while still pending. Expect 7 rows.
UPDATE public.owner_contact_alerts
   SET status = 'handled', handled_at = now(),
       handled_note = 'Cleared: caused by activities withdrawn on Oct 29'
 WHERE id IN ('05095529-0850-4cd9-8967-c4491ee57c56','10fb8c8f-8e4f-4a26-ac21-661fb732aad5','238c9515-12e9-4e30-89a5-893353b628fa','2d8b901c-a78d-428d-a0de-de11fd5ccaaf','3528e58b-ae6e-4dc9-9828-a4e093dc52df','918aa817-1d62-4361-81b7-abd6bfc7c7b0','b358175f-7944-4c18-a80d-a2b1b418f618')
   AND status = 'pending'
RETURNING id;
