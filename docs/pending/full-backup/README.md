# Back up everything (register N8). APPLIED Nov 8, 2026

| File | What it does | Undo |
|---|---|---|
| `01_full_backups.sql` | The backup record table `full_backups` (who, when, folder, counts, Verify result), Admin read only; and three readers only the server may call: the secret column rule, the table list with exact row counts, and a paged table reader that leaves secret columns out. | `01_undo_full_backups.sql` |

Applied byte-for-byte as migration 0298. Private storage bucket `backups` created (no public
access, no sign-in access; only the server reads and writes it).

Admin tools (Integrations page) > Back up everything: every table in the public schema to one
JSON file each plus `manifest.json` (every table, row count, fingerprint, size, left-out columns)
in one dated folder. Verify re-reads every file, checks each count and fingerprint against the
manifest, and compares counts with the live tables (a table that grew since is "changed", not a
failure). Secret columns left out: `app_user_connections.connection_key_ciphertext`,
`credential_intake_queue.secret_ciphertext/secret_nonce`, `integration_tokens.access_token_enc/refresh_token_enc`,
`marketing_photo_downloads.token_hash`, `property_credentials.secret_ciphertext/secret_nonce`.

First run, Nov 8, 2026, 3:44 PM Central, by an Admin: folder `2026-11-08_214435Z`, 232 tables,
97,777 rows, 233 files. Verify: every file matches; one table changed since (email job runs,
5,484 saved, 5,485 now).

Week one: a nightly schedule for this backup (roadmap).
