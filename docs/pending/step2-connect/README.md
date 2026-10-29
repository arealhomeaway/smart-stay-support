# Step 2 pending changes (not applied)

1. `handoff-ready-alert.sql` adds a trigger that alerts the Director of Operations seat holder and the person covering it (one in-app alert, email through the existing 5-minute job) when a home is marked ready. Undo: `undo-handoff-ready-alert.sql`.
   Undo proof: neither `notify_onboarding_handoff_ready` function nor trigger exists live (read-only count 0 and 0 on 2026-10-29), and `perform_handoff_step` is not replaced, so dropping both restores the exact live state.
2. `data-3915-closing-date.sql` corrects 3915 W 104th planned and actual closing to 2026-09-23 with a history note. Undo: `undo-data-3915-closing-date.sql` (history rows cannot be deleted, so the undo adds a reversal row).

Isolated proof: `src/lib/__tests__/handoff-ready-alert-rpc.test.ts`.
