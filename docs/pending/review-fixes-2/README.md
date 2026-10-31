# Review fixes 2 (staged, not applied)

Apply order: `01_plan_card_access.sql`, then `02_ao_central.sql`. Undo in reverse from `undo/`.

- 01 replaces `public.ao_submit_card`, `public.ao_owner_plan` (CREATE OR REPLACE, ACL kept) and alters the
  `ao_plan_read` / `ao_contrib_read` policies to use `private.owner_current_property_for_actor`.
- 02 relabels `private.ao_central` STABLE with a fixed search_path; body unchanged.
- `live-reference.json` holds base64 + sha256 + ACL of each replaced live function and the live policy text.
- Follow-up alert repair (item 5) is app-side only: no database change.
- Checks after apply: function sha256 differs only for the two replaced functions; ACLs equal live-reference;
  anon-executable SECURITY DEFINER set identical; undo restores sha256 in live-reference.json.
