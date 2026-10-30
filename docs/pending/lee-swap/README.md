# Lee main-homeowner correction: not applied

## Blocker requiring Emily's decision

The canonical `findOrCreateOwnerLogin` creates the login using the Auth Admin API. That external operation cannot join a PostgreSQL transaction. Ryan has no login. Creating auth records directly in SQL would bypass that canonical path and alter managed auth tables, so it is not permitted.

No account, membership, profile, invite or welcome was changed. No email was queued. The approved single transaction including login creation cannot be executed as written. The smallest safe alternative is canonical login creation followed by one authenticated, audited, atomic application-record transaction with a retained login receipt if the second phase fails. This alternative has not been authorized or executed.

## Read-only inventory

Program: 814b9c32-0910-499b-b4ac-2c7fc026569b. Home: 8602 E. Galveston St., non-demo. Current primary: 830332a2-3cee-4967-bd57-7cd625f8f9f9, profile named Ryan Lee, Lindsey's masked email lm***@gmail.com, owner role only. Program contact email already belongs to Ryan; program contact name currently represents the owner group, not a person's login name. Canonical property owner is unchanged.

- Six entries, 302 raw minutes, all attributed to the current login. Historical attribution must remain on that login after it is renamed Lindsey.
- Eight alerts: seven point to the current login and one has a null recipient. None reference a review or Ticket.
- No welcome rows. Thirty-two reviews, all archived, none answered. Seven work items, none retired, four answered.
- Three homeowner conversation messages from the current login. Seventeen program events: seven from that login, eight staff events, two without an actor.
- Five property documents, all staff uploads and none assigned to a homeowner recipient/program.
- Both specified Team invite codes remain unused and unrevoked.

## Smallest shared-history read fix

`read_owner_participation` already reads entries for any historical membership and events through the caller's active-member gate. Only alerts still require the historical recipient to equal the current primary. `01_shared_alert_history.sql` changes that single predicate to accept a program-wide null recipient or any recorded program member, keeping the caller's active membership, review and Ticket scope checks untouched. Historical rows and routine email delivery are not rewritten. Keeping null-recipient alerts also satisfies the request for all eight historical program alerts.

The manifest captures the live definition as base64, its SHA256 and exact ACL. The undo restores that exact definition. No grants, policies or triggers change. This read change is staged only, pending the blocked swap; no identity script is presented as executable while the single-transaction requirement remains unresolved.

## Not verified

No live swap, new-member read simulation, invite revocation, welcome delivery, sign-in or published UI acceptance was attempted. Part 1 is code/tests only and requires Emily's publish.