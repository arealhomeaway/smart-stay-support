# Notion ticket import: dry run (stopped, access needed)

Status: **stopped before reading any tickets.** Nothing was imported or changed.

## What I found

Resolve has a Notion connection ("Emily's Notion") and it works. It can read these tables:

- Properties Information Database (PID)
- Onboarding Project Database
- Onboarding Information Database
- STR Exception Owners, Owner Reviews & Decisions, Participation Activity (pilot)
- Pilot: Work Types & Response Standards, Operational Matters, Team Directory & Coverage Schedule, Ticket Activity Log
- RETIRED: Separate DFY Properties Pilot
- Micah Priority List

**The Maintenance Ticket Management database is not shared with this connection**, so its rows, fields and counts cannot be read.

## Access needed

1. In Notion, open the Maintenance Ticket Management database, choose Share (or the ... menu, then Connections) and add the Lovable connection used by Resolve.
2. If you re-run the Notion sign-in instead, re-select every page Resolve already uses (the list above). A new sign-in replaces the page selection for every Lovable connection on that Notion account.

## Plan once access is granted (no import until you approve)

- Rows: (a) every open ticket, and (b) every ticket edited in the last 30 days, de-duplicated by Notion page ID.
- Home matching by ID only: the ticket's relation to the Properties Information Database page ID, matched to the Resolve home that stores that Notion page ID, or the OwnerRez property ID on that page matched to the home's OwnerRez ID. No name matching. Rows that match neither are listed as unmatched.
- Duplicates: a row is a duplicate if a Resolve ticket already carries its Notion page ID, or two Notion rows point at the same page.
- Output for review: field mapping (Notion field to Resolve ticket field), counts (open, recent, total after de-duplication), duplicates and unmatched rows, written back into this file.
