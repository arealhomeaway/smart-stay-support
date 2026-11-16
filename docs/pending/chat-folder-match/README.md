# chat-folder-match (Approved by the Admin, Nov 16)

Team chat attachments failed: the folder picker sends the home's Files folders
(design, agreements, estimates, photos, inspections) but `post_home_chat_message`
only accepted the older shelf names. This changes only that staff folder list.

- apply.sql: same function as migration 0346 with the staff folder list replaced; GRANT EXECUTE; one audit row `chat_folder_match_applied`.
- apply.undo.sql: restores the 0346 function exactly; audit row `chat_folder_match_undone`.
- Owner-side attach rule (0346) unchanged.
- Preflight: live function had the 0346 list and owner rule (md5 983b9e81221eece81e46b1ca91347740).
- Practice: src/lib/__tests__/chat-folder-match-sql.test.ts (6 tests).
