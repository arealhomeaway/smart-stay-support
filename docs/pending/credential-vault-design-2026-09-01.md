# Guest Access & Credentials — design and PID credential audit

Status: design + audit only. Nothing built, migrated, published, or changed in Notion.
No credential value appears in this document.

## 1. Data model

### `property_credentials`

| Column | Purpose |
| --- | --- |
| `id` | uuid pk |
| `property_id` | fk → properties, cascade |
| `category` | enum `credential_category`: `wifi`, `gate_community`, `property_access`, `garage`, `lockbox`, `streaming`, `supply_storage`, `alarm_security`, `other` |
| `label` | plain, non-secret, always visible (e.g. "Guest WiFi", "Community gate — vehicle") |
| `username` | nullable, non-secret-ish account identifier (masked with the value for streaming) |
| `secret_ciphertext` | text, AES-256-GCM ciphertext (never selected by list queries) |
| `secret_nonce` | text |
| `instructions` | non-secret operating note ("keypad is on the left post; press # after") |
| `last_verified_on` / `verified_by` | freshness metadata |
| `source` | `notion_pid`, `staff_entry`, `owner_provided` |
| `sort_order`, `active` | display control |
| `created_by`, `created_at`, `updated_at` | audit |

Encryption is application-layer, not database-layer: the worker encrypts and
decrypts with Web Crypto using a key held in the platform secret store
(`CREDENTIAL_ENCRYPTION_KEY`, generated, never revealed). A database dump
therefore contains no usable secret, and no SQL query — including any future
`run_sql` — can read a value.

Column-level protection: `GRANT SELECT (id, property_id, category, label,
username, instructions, last_verified_on, verified_by, source, sort_order,
active)` to `authenticated`. The ciphertext columns are granted to
`service_role` only, so even an authorized staff session cannot pull ciphertext
through the Data API. Reveal goes through one authenticated server function.

### `credential_access_log`

`id`, `credential_id`, `property_id`, `user_id`, `action` (`reveal` | `copy`),
`ticket_id` (nullable), `occurred_at`, `user_agent_hash`. It records who
touched which labelled credential and when — never the value, never a fragment
of it.

### `credential_intake_queue`

Landing zone for secrets the detector finds in free text: `property_id`,
`source_field`, `suggested_category`, `secret_ciphertext`, `secret_nonce`,
`status` (`pending` | `accepted` | `rejected`), `reviewed_by`, `reviewed_at`.
The queue holds the secret already encrypted, so nothing sits in plaintext
between detection and filing.

Nothing is added to `properties` JSONB, notes, provenance, tickets, analytics
or search. Provenance for a credential records only that a value exists, its
category and its `as_of`.

## 2. Property Hub UX

A first-class card, "Guest Access & Credentials", sits directly under the
property header — above Systems and Documents, so it is on screen without
scrolling on a phone at 2 a.m.

Rows render in fixed operational priority: WiFi → gate/community → primary
property access → garage → streaming → supply/storage → alarm/security → other.

Each row shows: category icon, label, masked value (`••••••••`), **Reveal**,
**Copy**, `Verified <date>` (amber past 180 days, red past 365), and the
instruction line when present.

- Reveal fetches and shows the value in place, auto-remasking after 60 seconds.
- Copy fetches and writes to the clipboard without displaying, clearing the
  clipboard entry after 90 seconds where the browser allows it.
- No separate vault screen, no modal, no re-authentication, no step-up prompt.
- The value never enters the DOM until a Reveal, and never enters a URL, a
  query key, or a log line.
- A "Nothing recorded — add" affordance for supervisors keeps gaps visible.

## 3. RBAC (approved correction — internal vs external, not Operations-only)

The distinction is internal ARHA user vs owner/vendor/external, using the
existing ARHA role model.

| Group | Reveal / Copy | Create / Edit / Verify |
| --- | --- | --- |
| Onboarding staff | Yes | Yes |
| Operations Supervisor (`manager`) | Yes | Yes |
| Director-level / Admin | Yes | Yes |
| Operations staff — Team A Guest Experience, Team B Property Operations (`tech`/Staff) | Yes | No |
| After-hours / on-call staff | Yes (no extra grant) | No |
| Finance, leadership, internal support with a Resolve staff account | Yes | Per role above |
| Homeowners | No | No |
| Vendors | No | No |

Implemented as two database helpers over `user_roles`:
`is_internal_staff()` = admin, manager, tech, onboarding — read/reveal/copy;
`can_manage_credentials()` = admin, manager, onboarding — create/edit/verify.
Onboarding has full maintenance rights because collecting and keeping these
values current is part of the onboarding workflow. No credential-specific role
was invented, and no additional grant is needed after hours.

## 4. Account-level MFA

Supabase Auth (the platform behind Resolve) supports TOTP MFA today —
enrollment, verification, and an assurance level on the session. It is not yet
enabled in Resolve.

Recommendation matching your preference: enforce MFA once at the account level
for every staff account with credential access — enrollment on first sign-in,
assurance level checked at session start — and require nothing further at
reveal time. That gives strong protection with zero per-secret friction. This
is a separate small piece of work; it is not a prerequisite for the credential
card, though I would ship it in the same release.

## 5. PID credential audit — counts only

Populated values found across the 159 PID rows (values not reproduced):

| Category | PID field | Populated | Real secret-shaped | Narrative | "N/A"-type |
| --- | --- | --- | --- | --- | --- |
| WiFi | WiFi Password | 152 | 151 | 1 | 2 |
| WiFi (non-secret) | WiFi Network Name | 152 | — | — | — |
| Gate/community | Gate Code | 14 | 11 | 2 | 139 |
| Property access | Access Codes | 152 | 9 | 143 | 1 |
| Garage | Garage Keypad Code | 103 | 100 | 3 | 47 |
| Lockbox | Garage Trim Lockbox Code | 148 | 135 | 13 | 2 |
| Supply/storage | Storage Closet/Cabinet Code | 142 | 128 | 14 | 8 |
| Supply/storage | Closet Supply Box Code | 62 | 60 | 2 | 88 |
| Alarm/security | Alarm Code | 76 | 61 | 15 | 77 |
| Camera | Security Camera Feed | 108 | 11 | 97 | 44 |

Secrets additionally found embedded in descriptive free-text fields
(already redacted in the completed import, 11 written occurrences; full
detector sweep over the source finds 72 candidate occurrences):

| Source field | Occurrences |
| --- | --- |
| Access Codes (narrative) | 29 |
| What's Missing? | 27 |
| TV Specs (streaming logins) | 5 |
| Alarm Code (narrative) | 5 |
| Neighborhood Amenities Access Information | 3 |
| HOA Notes (General) | 1 |
| Neighborhood Pool Access Key/Fob | 1 |
| Storm Shelter Location & Access | 1 |

### Should migrate into the credential model

WiFi passwords (151), gate codes (11), garage keypad codes (100), lockbox
codes (135), storage/supply codes (188 across two fields), alarm codes (61),
streaming logins (5), and the free-text extractions routed through the intake
queue for supervisor confirmation. Roughly 650 credential records for ~157
properties.

Non-secret companions migrate as ordinary visible fields, not secrets: WiFi
network name, smart lock brand, router location, camera monitoring plan,
garage remote brand.

### Should stay excluded

- Camera/portal **login** credentials — the Ring/Blink/Alarm.com portal links
  are already stored as staff-only links with no credentials, and those
  accounts are ARHA-tenant accounts governed by account MFA, not
  property-scoped secrets.
- Narrative entries that describe access without containing a secret — they
  belong in `instructions`, not in an encrypted value.
- "N/A"/"Unknown" placeholders — they become an explicit "not recorded" gap.
- Owner personal account passwords found in free text (the TV Specs case):
  flagged to the supervisor for replacement with an ARHA-owned account rather
  than migrated.

## 6. Detector behaviour change

The scrubber shipped with the PID import currently redacts and drops. The
revised flow keeps the same detection but stops destroying operational value:

1. Detect the secret in the free-text value.
2. Encrypt it immediately and insert a `credential_intake_queue` row with the
   property, source field and a suggested category.
3. Replace the text in the descriptive field with
   `See Guest Access & Credentials` — a pointer, not a value.
4. Supervisor reviews the queue in a small Property Hub panel and accepts
   (promotes to `property_credentials` with a category and label) or rejects.
5. Plaintext never lands in a descriptive column, a log, an error, or a report
   at any step.

## 7. Schema impact

- 1 new enum (`credential_category`), 3 new tables, RLS + column-level grants
  on each.
- 1 generated secret (`CREDENTIAL_ENCRYPTION_KEY`).
- No change to `properties` columns or JSONB groups; the only data touch is
  replacing already-redacted placeholder text with the pointer string.
- Optional, separate: MFA enrollment state on staff accounts.

## 8. Recommendation

**GO** to build the credential model, Property Hub card and RBAC, with the
credential migration itself run as a separate approved pass, and account-level
MFA enabled in the same release. No credentials migrated, nothing published,
Notion untouched.
