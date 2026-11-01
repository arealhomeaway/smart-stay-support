# Operations pilot dispatch, staged only

No SQL in this folder has been applied. No live rows, accounts, templates, home plans or Tasks were changed. No sign-in, email, Breezeway call or publish was performed.

## Impact, read only at Nov 1 2026
The canonical outbound task ledger contains zero rows all-time and zero in the preceding 30 days. Recorded task creation: Work Order dispatch 0, onboarding 0, cleaning 0, inspections 0, other 0; unique homes 0. No automated task-creation caller was found. Operator sends use the common outbound creation path. Breezeway-native tasks and external systems are not measured by this ledger. Existing task comments, photos, edits and status changes are not new task creation and are outside this task-creation setting.

## Apply and undo
`01_guards.sql` adds Admin settings/history and reservation/close/result guards. Mode defaults to All verified homes even with no settings row, preserving the existing verified-mapping gate. Admin saves the home list and mode atomically with append-only history. Every new public table has explicit grants and RLS. New privileged functions deny anon/PUBLIC execution.

`undo.sql` removes only these new objects in reverse dependency order. Existing functions, triggers, policies and grants are not replaced. Therefore there are no replaced live functions needing restoration. `live-capture/` includes the existing authorization trigger definition, byte-exact base64 and server-verified SHA256 plus its ACL as a non-regression reference. Undo leaves canonical Work Orders and outbound rows intact; export any settings/history generated after future approval before removing those new tables.

Read-only live inventory confirmed settings/history/functions/dispatch_guarded absent and outbound ledger still empty. Staged SQL is intentionally outside migration history. Before future application, reverify absence and captured live fingerprint/ACL, then test on a production-schema copy.

## Dispatch safety
Only the accepted-vendor action passes `workOrderId`; its outbound branch never finds or creates another Work Order. Other existing generic task creation behavior is preserved. The exact branch refuses until the staged readiness function exists. It re-reads the selected Work Order, accepted mapping and appointment. The BEFORE INSERT transaction row-locks and reserves the selected Work Order, independently revalidating identity, open state, duplicate status, approvals, accepted person and appointment. The reservation is durable before the HTTP call. The close/update guard prevents closure or dispatch-input changes while creating or uncertain; result/reconciliation releases definite outcomes. A timeout remains uncertain with no automatic retry.

## Verification limitations
Mocked Breezeway tests and isolated PostgreSQL guard/undo tests run without live writes. Isolated PostgreSQL serializes transactions, so close-first and send-first ordering are tested, not two independent production connections. Signed-in Admin editing, real dispatch/assignment, published behavior and the full production trigger graph are not verified. No publish or database application is authorized by this work.