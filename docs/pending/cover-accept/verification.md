# Applied cover acceptance verification — October 29, 2026

- Original live `perform_handoff_step(uuid,text,jsonb,boolean)` SHA256 matched the verified undo: `e7aa07b8c4e135812dcad96874b22f275f4e4858be39887a11a68334be9c310e`.
- Applied by migration tool: `drizzle/migrations/0176_allow_active_director_ops_cover_handoff_acceptance.sql`.
- Post-apply live definition SHA256 equals the entire `apply.sql` bytes: `27814fdbb3f5eb641ede9b736a052248fd0270849872fda58a7aa7f30ec9f031`.
- `check.diff` changes only the accepted-step permission condition, adding the current `director_ops` override of kind `cover` matching `auth.uid()`.
- ACL unchanged: `{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}`.
- Before and immediately after, full-row ordered MD5 and count identical:
  - onboarding_projects: 9, `822d55455ced6ba8422d1ba2c8e300e4`
  - tickets: 35, `5d249aa43d154c4b464e2d77d0eee990`
  - staff_notifications: 432, `593b020fd33b936d11e26dfdee241b60`
- No handoff executed on any live home. No account, seat, secret, approval or real record written. No publish.
- Screen reads `seat_override_at` through the authenticated caller, omitting `_at` to use database `now()`; only `cover` grants additional visibility. Database acceptance remains the security boundary.
- Existing nine isolated acceptance tests and six new screen-rule tests cover holder, active/expired cover, PC, Admin, non-cover, signed-out and unchanged Mark ready behavior. Full suite: 1727 pass, 5 skip, 0 fail.