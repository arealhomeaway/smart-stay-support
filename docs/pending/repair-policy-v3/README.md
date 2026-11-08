# Repair approval ladder, policy v3

Decided by Emily on Nov 7, 2026 (punch list H1) and confirmed Nov 8, 2026. For repairs and
routine purchases:

- $249 and under: it proceeds and the cost is recorded.
- $250 to $349: the Operations Supervisor approves and the owner is told the same day.
- $350 and up: the Operations Supervisor and the owner both approve before work starts.
  Exactly $350 needs the owner.
- Emergencies: mitigate under a documented exception.

Before (policy v2): the Supervisor from $200, the owner only above $350 (exactly $350 stayed
with the Supervisor), and the owner tier did not also need the Supervisor.

## Files, in order

| Order | File | Tool | Undo |
| --- | --- | --- | --- |
| 1 | `01_expense_authorization_v3.sql` | migration tool, byte for byte | `01_expense_authorization_v3.undo.sql` |
| 2 | `02_policy_v3_value.sql` | data tool (one row in `app_settings`) | `02_policy_v3_value.undo.sql` |

Undo runs in reverse: 02 undo first, then 01 undo. `live-capture/expense_authorization_detail.sql`
is the live definition read on Nov 8, 2026 (identical to migration 0133, body md5
2b00445066e5f2a3f4371230414a9b8e); the 01 undo restores it exactly.

## What 01 does

Replaces `private.expense_authorization_detail`, the one database function that reads the
Maintenance Authority Policy numbers (Finance ready check, statement include and review
guards call it). Same signature, owner, SECURITY DEFINER, search path and grants.

- The linked Work Order keeps the policy version it was decided under: when its
  `policy_version` differs from the stored policy, the matching entry in the stored
  `previousVersions` list is used.
- From v3 (`ownerThresholdInclusive`), exactly the owner amount needs the owner.
- From v3 (`supervisorAlsoApprovesOwnerTier`), the owner tier is covered only when both the
  owner approval and the Operations Supervisor approval are recorded on the linked Work Order.
- Below the Supervisor amount the reason reads "Under $250: it proceeds and the cost is recorded."
- A policy without the v3 flags decides exactly as before, word for word (proved in the test
  by running the live copy and the staged copy side by side under v2).

## What 02 does

Stores policy v3 in the existing `app_settings` key `maintenance_authority_policy`, the way the
app already stores and versions this policy: version "ARHA Maintenance Authority Policy for
Resolve v3", Supervisor 250, owner 350, the three v3 flags, and v2 kept under
`previousVersions`. It only changes the row while it still holds the exact v2 value.

## Not changed

- `public.create_onboarding_financial_request` and the separate `onboarding_authority_policy`
  setting (onboarding cost requests keep their own rule; see the reply for the open decision).
- The `work_orders.policy_version` column default (it still names v2; the app now stamps v3 on
  every Work Order it creates).
- Every Work Order row: each keeps the `policy_version` it was stamped with.

## Proof run before applying

`src/lib/__tests__/repair-policy-v3-sql.test.ts` (isolated database) and
`src/lib/__tests__/repair-policy-v3.test.ts` (screens and rules).
