# Reported issue order links
Waiting for `Approved: apply reported-issue-order-links`.
Adds a many-issue association to one existing mirrored Breezeway work order. No external writes. Existing linked_ticket_id, bridge bookkeeping, routing, clocks, scores, sync and switches are untouched.
The shared ticket panel retains every exact issue ID captured from the rolled-up row. Each issue opens the existing canonical workspace. The group Send Breezeway Work Order button calls one caller-authenticated transaction, with no separate-write fallback before approval.
Preflight confirms new objects absent and canonical authority helpers present. Apply with one audit_log application receipt in a transaction. Verify grants, RLS, anonymous refusal and retained mirror fingerprints. No live work order is linked during application.
Practice checks all-or-nothing, same-home/open/reported-issue eligibility, existing editor authority, synthetic-real refusal, conflicting links, repeated clicks without duplicate history, and undo refusal with retained links. No external service is contacted.
Undo disables new writes but keeps every association and history entry. Single-ticket linking remains unchanged.
