# Breezeway approval write-back: investigation only

Status: not built. Resolve does not write Maintenance Review approvals back to Breezeway.

## Does the Breezeway API support approving a work order?

Yes. Breezeway documents `POST https://api.breezeway.io/public/inventory/v1/task/{id}/approve`
("Action to move task to 'Approved' status"). Source: https://developer.breezeway.io/reference/approve-task

Conditions from Breezeway's documentation and help center:
- A task can only be moved to Approved if it was previously **Closed**. Our queue is Breezeway
  status **Finished**, so a Finished task would most likely need to be closed first
  (`POST /task/{id}/close`), then approved. This two-step order is unverified against the live account.
- The account must have "Approve tasks after completion" turned on (Settings > General > Operations).
  It is on for ARHA: 767 maintenance and 585 housekeeping work orders already show Approved.
- Approved is reserved for Administrators and Supervisors in Breezeway.

## What Resolve already has

`approveWorkOrder` in `src/lib/breezeway-workorders.server.ts` already calls `/task/{id}/approve`
behind the existing Breezeway write guard, and the Breezeway work order panel on a ticket has an
approve button for linked work orders. The new Maintenance Review routine does not call it.

## What a write-back would need (decision for Emily)

1. Approval that writes to Breezeway are allowed for maintenance reviews (Breezeway is transitional;
   outbound writes stay behind the property allowlist).
2. Confirm the close-then-approve order on one test work order.
3. Decide what happens if Breezeway refuses: the Resolve review stays approved and the failure is shown.

Until then, a vendor marking work Finished never counts as reviewed; only a completed Maintenance
Review in Resolve does.
