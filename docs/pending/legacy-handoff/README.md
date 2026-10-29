# Legacy handoff retirement — pending, not applied

The unused `markReadyForOperations` / `acceptIntoOperations` application wrappers were removed. No remaining src callers or database function-body callers were found. The historical duplicate-step isolated test now exercises `complete_handoff_step_tasks` directly with matching synthetic handoff state and actor, preserving canonical helper coverage.

`drop.sql` is not applied and has no CASCADE. `undo.sql` concatenates both exact live UTF-8 `pg_get_functiondef` captures, in the order recorded by `capture.json`; individual `.sql` files preserve each capture separately. The base64 values decode directly, without text-output parsing. Each SHA256 matched the database-provided SHA256 before writing.

- `public.accept_into_operations(uuid)`: `f3b6d3dd9c10fb95c96295fe14765b8ef35c66d3b34a5c7e8fd20a0fba07d508`
- `public.mark_ready_for_operations(uuid)`: `84b1f37db6abfaec69d3aef0c6bc5070c7579bb3ec9bbb41b1e2e3fcb4e5e543`
- Combined undo SHA256: `fbb57061601eeb182bce32082df99a2475bfec47c4f0dacff23cc7ea34f62dbd`

Both currently have EXECUTE for PUBLIC, postgres, anon, authenticated, service_role. If restoring after a future drop, recreating functions defaults PUBLIC EXECUTE (therefore allowing anon/authenticated); explicit original grants are captured in `restore-grants.sql`. Apply that separately after the exact-definition undo to restore the original ACL, not merely effective permissions.