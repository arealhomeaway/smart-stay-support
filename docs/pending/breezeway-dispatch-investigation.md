# "Key not working" at 5217 NW 109th St: why Push to Breezeway is disabled

Investigation only. Nothing was changed in the app or the data. Read on Nov 4, 2026.

## What the record shows today

- Ticket #628 "Key not working", status In progress, real home (not demo).
- One Work Order (8de26733…), created Nov 3 15:52 UTC, priority P2, category handyman.
  - Breezeway handoff: Not sent. Dispatched: no. Appointment (scheduled for): empty.
  - Vendor on the Work Order: Steve Carroll.
- Vendor list for that Work Order has one row: Steve Carroll, status **candidate** (Primary choice). It was never marked **accepted**.
- Steve Carroll's vendor record: dispatch method Breezeway, Breezeway person 335276. So he really does use Breezeway, which is why the badge shows.

## When the button appears and when it is enabled

Screen: Work Order drawer, Vendor sourcing panel, section 3 "Breezeway".

1. The button shows for anyone who is not read-only, unless the last attempt is "uncertain" (then the reconcile box shows instead).
2. It is enabled only when `breezewayPushEligibility` (src/lib/vendor-sourcing.ts) returns no reasons:
   - a vendor on the list is marked **accepted**;
   - the **accepted** vendor uses Breezeway (dispatch method Breezeway or a Breezeway person id);
   - the Work Order's authorization is satisfied;
   - it has not already been handed off, and no attempt is uncertain.
   A failed attempt also enables it as "Retry Breezeway handoff".
3. When the server receives the push it checks again (pilot dispatch guards): exact open Work Order on this Ticket and home, accepted vendor with a Breezeway mapping, an appointment date and time, sending scope for the home, and no earlier send.

## What blocks it in this case

- Steve Carroll is a **candidate**, not **accepted**. Nobody pressed the accept step for him.
- Because no vendor is accepted, the screen checks Breezeway use against "no vendor" and reports "The accepted vendor does not use Breezeway". That message is misleading: it should not appear when nothing is accepted. It sits next to the correct message "A vendor has not accepted the work yet", which is why the two look contradictory.
- Even after acceptance, the server would still refuse until the appointment (date and time) is filled in, because the Work Order has no scheduled time.

## Fix options

1. **Use it as designed (no change):** on the Work Order, mark Steve Carroll as accepted, enter the agreed appointment, then Push to Breezeway. This is the quickest path for this ticket.
2. **Clearer message (small screen change):** only show "does not use Breezeway" when a vendor is actually accepted; when none is accepted, show one line such as "Mark the vendor as accepted to send to Breezeway." Also list "Add the appointment date and time" before the push, so the server refusal is not a surprise.
3. **Accept from the badge (small screen change):** when the only candidate already uses Breezeway, offer a "Mark accepted" button right in the Breezeway section.

Options 2 and 3 are screen-only. None of them needs a database change.
