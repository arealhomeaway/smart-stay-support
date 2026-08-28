# Where real files will live — for approval before anything is provisioned

Nothing in this document has been built or configured. No bucket exists, no
permission has changed, no file has been written anywhere.

## The short version

Real photos, videos and documents attach to the ticket or onboarding task
inside Resolve, held in Resolve's own private file storage. SharePoint stays
what it is today: the ARHA Resolve document site, connected read-only, for
material that already lives there. Files are not kept in two places.

## Why not put attachments straight into SharePoint

The SharePoint connection is a *delegated* one — it acts as a single
Microsoft identity (resolve.integration@arealhomeaway.com) that an admin
connected by hand, scoped to the one ARHA Resolve site, and it has only ever
been validated read-only. Three consequences:

1. Every staff upload would be written as that one identity, so SharePoint
   would show one author for all files. Resolve would have to keep its own
   record of who really uploaded what — which means a Resolve row per file
   regardless.
2. The connection is per-admin and expires. An upload failing because an
   admin's token lapsed is not acceptable for day-to-day field photos.
3. Owner and vendor visibility would have to be enforced by handing out
   SharePoint links, i.e. access controlled outside Resolve, which is exactly
   what the owner-sharing rule cannot allow.

## Recommended architecture

- **Storage:** one private Resolve bucket, `resolve-attachments`. Private
  means no public URLs at all; every view or download is a short-lived signed
  link minted server-side after the request is checked.
- **Layout:** `{entity_type}/{entity_id}/{uuid}-{filename}` —
  e.g. `ticket/6f2…/9c1…-water-heater.jpg`. Because the path carries the
  record, files stay attached through reviews, handoffs and closure; a
  handoff changes the assignee, not the record id.
- **Index:** the existing `documents` table, which already has the
  `storage_path` column, plus a visibility flag per file
  (`internal` / `owner_shared`).
- **Size limit:** 50 MB per file — enough for phone video clips, small enough
  to fail fast rather than hang on site.

## Who sees what

| Who | Can see | Can upload |
| --- | --- | --- |
| Staff | every file on records they can already open | yes — photos, video, documents |
| Owner | only files explicitly marked owner-shared, on their own property | only where a document was requested of them |
| Vendor | nothing here — vendors keep submitting in Breezeway | no; Resolve vendor portal stays paused |

Enforced by row-level rules in the database and re-checked server-side when
the signed link is minted, so a copied link cannot be passed to someone
without access.

## SharePoint's continuing role

Unchanged, read-only, ARHA Resolve site only. Optionally, later and only if
asked: a one-way copy of closed-record evidence into that site for long-term
retention. Not part of this phase, and not proposed as a second live copy.

## What needs approval

1. Creating the private `resolve-attachments` bucket (new storage).
2. A migration adding the per-file visibility flag and the access rules on
   the `documents` table (new permissions).

Testing after approval stays on isolated records: upload, download, an owner
account confirming it cannot reach an internal file, the size limit
rejecting an oversized file, and an interrupted upload leaving no orphan row.
No external file write, and mailbox polling and other automation stay paused.
