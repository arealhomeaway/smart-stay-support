# Portal requests in Direct Bookings (Emily, Nov 9, register D8)

Portal requests (Owl Marketplace, ReloQuest, Travelers Haven, Realto) are answered
by email and in the partner's own portal. Phase 1: the team picks the Referral
source by hand. No partner recognition, no Email domains field.

## Files

| File | What it does |
| --- | --- |
| `01_portal_requests.sql` | Adds five optional columns to `leads`, three checks, the guard trigger, "I answered in the partner's portal", the Supervisor or Admin correction, and one line in `record_direct_booking_reply`. |
| `01_undo_portal_requests.sql` | Removes all of it and restores `record_direct_booking_reply` exactly as captured live. |
| `live-capture/` | Today's `record_direct_booking_reply`, `request_direct_booking_approval`, `decide_direct_booking_approval` and `record_direct_booking_follow_up`, byte-identical to live on Nov 10, 2026 (md5 checked). Only the first is changed. |
| `sha256.txt` | Checksums of the files above. |

## What changes in the database

New columns on `public.leads`, all optional:

- `portal_link`: the partner request link read from the email at intake. A check allows only
  `owlmarketplace.com`, `reloquest.com`, `travelershaven.com`, `aleasetech.com` and their subdomains
  (`source.owlmarketplace.com` included), at most 2,000 characters.
- `reply_method`: `email` or `portal`, set when the clock stops. Replies sent before are backfilled `email` (0 rows today).
- `portal_answered_at`, `portal_answered_by`, `portal_answer_note` (one line, at most 200 characters).

New functions (caller authenticated, `SECURITY DEFINER`, executable by signed in users only):

- `answer_direct_booking_in_portal(_lead_id, _note, _reply, _property_ids)`: needs a note. Before any
  reply: sets `reply_sent_at` to the press time (the clock stops exactly as for an emailed reply),
  `reply_method = 'portal'`, stage `engaged` (Quote sent, Waiting on the partner view), the 48 hour
  follow up, one history line "Answered in the partner's portal". During the approval period only after
  the quote was approved (the same approval test `record_direct_booking_reply` uses); after the period
  the person who started the request may press it at once, and the Operations Supervisor gets the same
  copy alert as for an emailed reply. Active Owner homes are refused again. Already emailed: the reply time
  and method stay; only the portal answer and the history line are added. Pressed twice: nothing changes.
- `correct_direct_booking_portal_answer(_lead_id, _reason)`: the Operations Supervisor or an Admin only,
  with a reason, before a follow up, the partner's approval or an outcome. Clears the portal answer (and
  the reply time when the portal answer stopped the clock) and writes "Portal answer corrected".
- `guard_lead_portal_fields` trigger: signed in users cannot write the five new columns directly
  (intake may insert the link). Resolve's own functions can.

Changed: `record_direct_booking_reply` gains `reply_method = 'email'` in its update. Nothing else in it changes.

Unchanged: who may start, send, approve or mark an outcome; the approval period; the 3 minute clock; the
2 minute wait; the 48 hour follow up rule; every alert text; the daily summary; scheduled jobs.

## Apply

Apply `01_portal_requests.sql` through the migration tool, byte for byte. Check:

```sql
SELECT column_name FROM information_schema.columns WHERE table_name = 'leads'
 AND column_name IN ('portal_link','reply_method','portal_answered_at','portal_answered_by','portal_answer_note');  -- 5 rows
SELECT proname FROM pg_proc WHERE proname IN ('answer_direct_booking_in_portal','correct_direct_booking_portal_answer','guard_lead_portal_fields');  -- 3 rows
```

## Undo

Roll the app code back first, then run `01_undo_portal_requests.sql`. It drops the portal links and portal
answers recorded since; the history lines stay.
