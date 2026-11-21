# Applied

- When: 2026-11-21 17:44 UTC, after "Approved: apply homeowner-reopen".
- Checksums verified (CHECKSUMS.sha256 all OK). Preflight re-run: table and three actions absent,
  ao_edit_card_answer md5 2b3672794e95c6f7a60b91a6bffa3926 as on Nov 21. Only difference: Shannon Linder
  33 current of 65 (was 65 of 65), the result of shannon-hours-links applied at 17:41.
- apply.sql applied unchanged as drizzle/migrations/0358_homeowner_reopen.sql (diff identical).
- Read back: owner_update_time_entry, owner_add_to_opportunity, owner_item_add exist, run as definer,
  callable by signed-in users only (not anon, not public). private.record_homeowner_update not callable by
  app users. homeowner_updates: RLS on, 3 policies (staff read, own read, demo restriction), no write policy,
  append-only trigger on, 0 rows. ao_edit_card_answer replaced (new md5 32634fd456a731f18c6a5717f24a96d5).
- Shannon: 65 entries, 33 counted, 2,523 minutes, 32 links (unchanged by this package).
- 1 audit_log row (homeowner_reopen.apply).
- Since 17:43:45 UTC: 0 chat lines, 0 owner messages. 1 owner notice + 1 email + 1 program event, all the
  regular 17:45 pace pass for Shannon's program ("Significantly behind"), caused by her lower total after
  shannon-hours-links, not by this package. See shannon-hours-links/APPLIED.md.
- Undo: apply.undo.sql.
