# Active Owner access boundary — September 16 follow-up

Static repository audit at the checkpoint following `8a84310531c50324bfd83ae45213aa44df817de7`. No backend inspection or shared migration was performed. These are remaining implementation defects, not merely missing browser acceptance.

## Current direct-read gaps

- `20260821043207_2e25ffe3-b9bb-4fcb-be2a-e684bb8cb2da.sql` grants owner SELECT on program and review rows. Later columns include program `internal_notes`/`completion_report` and review `staff_context`. An application response allowlist does not restrict direct table SELECT columns.
- `20260821143055_492f3645-563a-4b91-ad95-1d0307c54e51.sql` grants owner program-event reads, including private audit detail, reason and prior/new values.
- `20260821120447_8d9d36d3-9578-4f9d-98da-a41dccd8f63d.sql` supplies owner Ticket/Property SELECT policies. These expose raw operational text and restricted property fields on otherwise visible rows.
- The latest `private.owner_sees_property` in `20260828020936_bcbd2bd2-23f5-4426-9ef3-4ab527cac4d0.sql` accepts either the program anchor Property or any enrollment row. It does not require included enrollment, current canonical Owner match, active canonical Owner, demo alignment or an unarchived program.
- `private.owns_program` retains the original account-link test (`owner_user_id`), moved into the private schema by `20260821194743_822b021b-0c27-4009-a3e2-46fda6b01d5b.sql`. It does not independently establish canonical Owner validity.
- Hub/report program selection likewise uses the account link. The staff-capable aggregate does not establish a separate current external-owner context. Owner Ticket authority/narrative RPCs have narrower checks, but those RPCs do not constrain the aggregate or the direct raw reads above.

Consequences: excluded/transferred properties can remain visible through existing policies, and permitted rows can expose staff-private columns through direct authenticated database requests. Migration 39 closes a review UPDATE policy; it does not fix these SELECT policies.

## Narrow fixes in this checkpoint

The owner opportunity transport now explicitly lists its fields. Manual opportunity `staff_context` and future unlisted fields are excluded. Automatic Ticket opportunities also exclude raw evidence, impact, outcome, attachment and photo fields; current narrative comes from the reviewed Ticket projection. Manual owner-authored publication fields remain supported; their legacy content and attachments still require a complete publication/authorization review.

Owner report actions use a fixed event-type allowlist with safe descriptions. They do not copy arbitrary program audit summaries or new values. Exact response narratives continue to come from immutable response receipts. These transport changes do not claim to secure direct table reads.

## Remaining implementation sequence within the existing architecture

1. Introduce an external-owner read boundary for Program, Property and Ticket using the canonical eligibility joins already used by `read_owner_ticket_authority`. Keep staff aggregate behavior available. Separate currently accessible property context from retained historical participation.
2. Route hub, report, approval and owner Ticket-creation dependencies through that boundary before removing raw owner SELECT policies. Check helper dependencies: `owner_sees_property` also affects approval reads/updates, owner-visible onboarding tasks and Ticket INSERT; `owns_program` affects reviews, links, badges, history and time/notification flows.
3. Extend explicit reads to reviews, events, notifications and documents/assets; do not expose unrestricted fields merely because a row belongs to an owner. Preserve immutable time/response history when enrollment ends.
4. Audit independent account-based policies and alternate direct writes, including approval UPDATE and time-entry/property-link INSERT. Function guards cannot protect a separately permitted direct writer.
5. Verify the full schema with actual owner/staff JWTs, two unrelated owners, included/excluded/transferred/demo properties, and separate concurrent sessions in an approved isolated environment.

Do not globally tighten shared helpers without checking historical access and staff dependencies. Do not apply shared/live migrations as a way to discover compatibility. Authenticated acceptance is **not yet the only major gate**.
