# Legacy reference migration inventory (Notion / Asana / Smartsheet)

Scope: every onboarding template task whose instruction body still sends the
employee into Notion, Asana or Smartsheet. Fillout is already retired and does
not appear. SharePoint/OneDrive links are **not** legacy — SharePoint is the
approved document backend; those are listed separately at the end as
"surface through Resolve" work, not migration work.

Count: 47 tasks carry a legacy reference (higher than the earlier ~30 estimate,
because Smartsheet was not counted before).

Destination key: **Playbook** = procedural guidance into a Resolve playbook ·
**SharePoint doc** = stays a document, surfaced through Resolve ·
**Structured data** = belongs in a Resolve record (property / vendor / cost) ·
**Archive** = obsolete or duplicated by Resolve itself.

## A. Asana project-status upkeep — Archive (beta critical)

| Task | Current link/system | What it contains | Still authoritative? | Proposed destination | Beta critical? |
|---|---|---|---|---|---|
| Update project status in Asana (phase 1) | Asana project plan | Instruction to move the Asana status field | No — Resolve is the plan | Archive | Yes |
| Update project status in Asana (phase 2) | Asana | same | No | Archive | Yes |
| Update project status in Asana (phase 3) | Asana | same | No | Archive | Yes |
| Update project status in Asana (phase 4) | Asana | same | No | Archive | Yes |
| Update project status in Asana (phase 5/handoff) | Asana | same | No | Archive | Yes |
| Update project status in Asana (phase 6) | Asana | same | No | Archive | Yes |

These six tasks exist only to keep Asana in step with reality. Once Resolve is
the plan they are self-referential. Removing them is the single largest step to
"no task requires Asana", and it needs Kati's confirmation only because it
deletes six rows from the template.

## B. Asana-hosted attachments — SharePoint doc

| Task | Current link/system | What it contains | Still authoritative? | Proposed destination | Beta critical? |
|---|---|---|---|---|---|
| Verify the property mailing address at USPS | Asana asset link | USPS verification walkthrough asset | Likely yes | SharePoint doc + `mailing_address` field (map v2 §2) | Yes |
| Follow-up on STR permit information | Asana task request | Cross-team request for permit info | No — this is a Resolve ticket/handoff | Structured data (Resolve request) | Yes |
| Add property to Truvi | Asana asset link | Truvi setup asset | Kati to confirm | SharePoint doc | No |
| Purchase essentials for property | Asana + Smartsheet | Order routine and essentials sheet | Yes | Playbook + Smartsheet content → Structured data (essentials list) | Yes |
| Purchase furnishings and décor | Asana | Ordering routine | Yes | Playbook | No |

## C. Notion vendor / work-order database (one page, 6 tasks) — Structured data

The same Notion page `1444658d…` is referenced by:
Schedule carpet cleaning/replacement · Create work order for home repairs ·
Assign all home improvement/cleaning/staging/landscaping work orders ·
Schedule lawn maintenance before photos · Schedule & manage pest control ·
Set up the Trash Valet Service.

| Field | Value |
|---|---|
| Contains | Vendor directory: who to call by trade and market |
| Still authoritative? | Partly — Resolve `vendor_orgs` + `property_vendor_coverage` already hold this |
| Destination | **Structured data** — vendor selection happens in Resolve dispatch |
| Beta critical? | **Yes** — this is the most-used legacy link in the plan |

Also `1944658d…` (camera/lawn vendor note) folds into the same vendor records.

## D. Notion results databases — Structured data (Resolve evidence)

| Task | Current link/system | What it contains | Still authoritative? | Proposed destination | Beta critical? |
|---|---|---|---|---|---|
| Review the New House Setup Form Results | Notion New House Setup Database | Intake answers for the home | No — belongs on the property record | Structured data (Property Hub → Property details) | Yes |
| Review the Standard Inspection Results | Notion Standard Inspections DB | Assessment findings | No | Structured data (assessment task + evidence) | Yes |
| Review the Final Inspection Results | Notion Final Inspections DB | Final assessment findings | No | Structured data | Yes |
| Order supplies from Pre-Work Inspection results | Notion Pre-Work Inspections | Assessment findings → purchase list | No | Structured data | Yes |
| Complete the Mid Project Review Form | Notion results page | Mid-project review | **Already replaced** (native) | Archive the link | Yes |
| Interior Camera Check | Notion page | Camera placement/disclosure rules | Yes | Playbook + `security_systems` field (map v2 §6) | No |

## E. Notion SOP / how-to pages — Playbook or SharePoint doc

| Task | Current link/system | What it contains | Still authoritative? | Proposed destination | Beta critical? |
|---|---|---|---|---|---|
| Review STR requirements and notify PM of costs | Notion Active Projects page | STR permit requirements by market | Yes | SharePoint doc (per-market reference) | Yes |
| Enter estimate into Houzz Pro | Notion Houzz Pro guide | Step-by-step tool guide | Yes | Playbook | No |
| Complete the Repair Estimate Approval Form | Notion form page | Estimate approval routine | Partly — approval belongs in Resolve | Structured data (Resolve approval) | Yes |
| Order custom blinds | Notion page | Supplier + measuring routine | Yes | Playbook | No |
| Schedule professional photo shoot | Notion Flow Photography guide | Booking routine + vendor | Yes | Playbook + vendor record | No |
| Confirm photo shoot / purchase photos | Notion purchasing guide | Photo purchase routine | Yes | Playbook | No |
| Upload photos & marketing content via OwnerRez | Notion tutorial | OwnerRez listing tutorial | Yes | Playbook | No |
| Follow-up on PriceLabs & sales tax setup | Notion Base Price page | Pricing connection routine | Yes | Playbook | No |
| Set up Breezeway/Yale integration | Notion Properties Information DB | Lock + property data | No — transitional | Structured data (Property Hub access section) | No |
| Assign a Default Cleaner | Notion + Breezeway | How to find the head cleaner | Partly | Structured data (cleaning region + vendor coverage) | Yes |
| Final review — property costs | Notion cost page | Cost roll-up | No | Structured data (cost record) | No |
| Utility set-up tasks (internet, electric, gas, water, trash) — 5 tasks with an "Add to Notion" subtask | Notion property DB | Recording the account after set-up | No | **Structured data** — `utilities` field (map v2 §5) | Yes |

## F. Smartsheet — Structured data or SharePoint doc

| Task | Current link/system | What it contains | Still authoritative? | Proposed destination | Beta critical? |
|---|---|---|---|---|---|
| Select essentials list / modify for bathrooms | 2 Smartsheet sheets | Essentials purchase list by home size | Yes | Structured data (essentials list template) | Yes |
| Create work order — boxed furniture assembly | Smartsheet link | Assembly scope for the crew | Yes | Structured data (Resolve work order) | Yes |
| Create work order — staging decor | Smartsheet link | Staging scope | Yes | Structured data (Resolve work order) | Yes |
| Approve carpet / repair / paint / landscaping work (4 tasks) | One Smartsheet approval sheet | Approval log for trade work | No — Resolve approvals exist | Structured data (Resolve approval) | Yes |
| Provide final costs to Accounting | Smartsheet + Houzz Pro | Cost summary for owner invoice | Yes | SharePoint doc (accounting hand-off) | No |
| Complete New House Handoff form | Smartsheet or Fillout | Handoff form | **Already replaced** (native handoff) | Archive the link | Yes |

## G. SharePoint / OneDrive references — not legacy

11 tasks link to SharePoint documents (warm-transfer letter, HOA covenants
folder, photo storage). These stay document-based. The work is to surface them
through Resolve once the site-level write grant lands, so the employee never
opens SharePoint directly.

## Summary by destination

| Destination | Tasks | Beta critical |
|---|---|---|
| Archive | 8 | 8 |
| Structured data (Resolve records) | 21 | 17 |
| Resolve Playbook | 9 | 1 |
| SharePoint doc (surfaced in Resolve) | 5 | 2 |
| Kati to confirm authority | 4 | – |

## Recommended order

1. Archive the six Asana status tasks and the two already-replaced form links.
2. Point the six vendor-database tasks at Resolve dispatch.
3. Move the five utility "Add to Notion" subtasks onto the `utilities` field.
4. Convert the assessment-results reviews to Resolve evidence.
5. Playbooks last — they are guidance, not workflow blockers.

Nothing in this file has been changed in the template. It is an inventory and a
recommendation, pending Kati's confirmation of what remains authoritative.
