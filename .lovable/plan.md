# "Act as" test mode for staff

Today a supervisor can only *look* at a homeowner's portal ("Preview as homeowner") — every
button is disabled, so you cannot test what Victor actually experiences when he logs hours,
opens a task, or approves something. This adds a real, audited "Act as" mode.

## What you get

- On the Active Owner board (and on Victor's program), an **Act as this homeowner** button
  next to the existing preview button. Admins and managers only.
- Clicking it opens Victor's portal as Victor — fully working, not read-only. Hours logging,
  task responses, approvals and uploads all behave exactly as they do for him.
- A permanent orange bar across the top: "You are acting as Victor Perez — anything you do is
  recorded as him" with a **Return to my account** button that puts you straight back into your
  own supervisor session, on the page you left.
- Every entry and exit is written to the audit log (who acted as whom, when), and shows up in
  the existing access log page.
- The read-only "Preview as homeowner" stays exactly as it is, for when you just want to look.

## Important consequences (please confirm you want this)

- Actions taken in this mode are genuinely the homeowner's: logged hours count toward his 90-day
  clock, approvals count as his approval, notes are attributed to him. It is a test mode only in
  the sense that you choose what to do — the data is real.
- While acting as Victor you do not have your own staff access; you see only what he sees until
  you press Return.

## Technical approach

1. **Server function** `startActAs` (`src/lib/act-as.functions.ts`, handler in `act-as.server.ts`):
   - guarded by `requireSupabaseAuth` + `is_supervisor` RPC on the caller;
   - target must be an owner account reachable through an `owner_programs` row (no acting as
     another admin);
   - uses the admin client (`await import("@/integrations/supabase/client.server")`) to
     `auth.admin.generateLink({ type: "magiclink", email })` and returns the OTP hash;
   - inserts an `audit_log` row (`act_as_started`, actor = staff id, target = owner user id).
2. **Client** `src/lib/act-as.ts`: stores the staff session (`supabase.auth.getSession()` access +
   refresh token) in `sessionStorage` under `resolve.act-as`, then `supabase.auth.verifyOtp` with
   the returned hash to become the owner. `Return` calls `supabase.auth.setSession(...)` with the
   stored staff tokens, clears the key, logs `act_as_ended`, and navigates back to the origin page.
3. **Banner** `src/components/ActAsBanner.tsx`, rendered in `AppShell` whenever the stored
   act-as record exists. Survives reloads; the record is cleared on sign-out.
4. **Preview boundary**: `bindPreviewAccount` already wipes preview keys when the signed-in
   account changes — extend it to leave the act-as key alone (it is the reason the account
   changed) and to clear it when returning.
5. No change to owner RPCs or RLS: the session really is the owner's, so every existing policy
   and `auth.uid()` check works unmodified.

## Verification

- Act as Victor from the Active Owner board, log an hour against 9211 Fitzgerald, confirm it
  appears in his participation history, then Return and confirm the supervisor session is back.
- Confirm a non-supervisor account gets a refused response from `startActAs`.
- `bun test` + typecheck.
