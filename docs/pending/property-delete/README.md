# Delete property: staged only

Requested by Admin on Nov 24, 2026. H9 permits the narrow onboarding-property exception. Nothing in this folder has been applied. No home has been deleted. Nothing has been published.

## Application gate

Apply only on `Approved: apply property-delete`, through the database migration tool. Re-run preflight immediately before application. This is not yet an exact, complete implementation of item 6: do not treat this folder as ready for approval while the limitations below remain.

- `01_property_delete.sql`: new action-specific authority, safety check, transactional removal, audit, direct-delete guard. No existing director helper, ticket policy, Offboard function or scheduled job is replaced.
- `preflight.sql`: read-only baseline and existing-action checks.
- `undo.sql`: removes only this new capability. An actual property deletion cannot be undone by this file.
- `director-baseline.json`: captured live helper hashes.
- `checksums.sha256`: package integrity.

## Current director chain, verified live

`public.is_director` calls `private.is_director`. That allows the `admin` account role alone or the identity returned by `seat_holder_at('director_ops')`. `seat_holder_at` uses the latest currently applicable `coverage_overrides` row only when its kind is `cover`, otherwise the `functional_roles.current_seat_holder` for `director_ops`. `private.has_role` checks `user_roles`. There are no other director codes, functional memberships, Supervisor or onboarding staff in this chain.

`public.is_onboarding_director` separately includes current holders of `onboarding_director`, `director_onboarding`, and `director_ops`. Delete authority combines these existing checks for this action only. All six captured helpers remain unchanged.

## Isolated practice

`bun test src/lib/__tests__/property-delete.test.ts src/lib/__tests__/property-page-part1.test.tsx`: **79 passed, zero failed**, including 39 new deletion checks. Practice is an in-memory PostgreSQL-compatible fixture, never the shared live database. Tests cover the exact captured director chain, allowed/blocked roles, raw-delete refusal, stages, five required safety categories, empty JSON response handling, stale-check revalidation, typed address/reason, graph removal with counted cascades, forced rollback with no audit, permanent audit and capability undo preserving director definitions.

The practice fixture is NOT a complete clone of every live trigger or dependency. Full-schema practice is not verified. Current immutable owner-program/enrollment history and some linked records may block deletion; no existing guard is disabled or bypassed to make tests pass.

## Limits and deviations

1. Stored file bytes in private storage or SharePoint cannot be removed in the same PostgreSQL transaction. This draft blocks homes with stored/external files rather than deleting only their rows. Item 6 is Partly, not done. A reviewed file-removal contract is required before expanding this.
2. Unknown dependencies, records shared with another home, and non-onboarding families are blocked instead of silently deleting them or nulling links. This adds safeguards beyond the five requested categories. It preserves existing history rules but means this is not the exact requested removal for every qualifying home.
3. Until database approval/application, the signed-in preview displays the red menu and confirmation warning, but safety checks report unavailable and Delete remains disabled. There is no alternate direct-write fallback.
4. The full baseline and after-change Bun runs were incomplete; the baseline exceeded the 600-second execution limit and the later long run was stopped before reporting. No full-suite pass is claimed. An initial Vitest attempt was incompatible with existing `bun:test` files. No test was weakened. The harness reported build/typecheck OK after correcting the new test hook typing.
5. Live-schema end-to-end deletion is deliberately unverified: no live mutation is authorized. Published code was not changed or browser-tested.

## Read-only candidate list

These homes pass the five specified business safety checks and lifecycle check, using live read-only queries. This is not permission to delete, nor certification that all additional file/history guards in this draft pass.

| Address | Created, Central time | Creator in property record |
|---|---|---|
| 123 test, Oklahoma City, OK 73130 | Nov 24, 2026, 11:14 AM | Not recorded |
| 5253 Trace, Greenwood, IN 46142-9648 | Nov 24, 2026, 11:19 AM | Kati Hand |

The second home has empty `[]` homeowner response arrays, not recorded decisions; these correctly do not block the specified safety test. All other Onboarding homes fail OwnerRez, participation/Finance, or handoff checks.

## Signed-in preview check

As the requester: `/onboarding/213d4ac4-b5b8-4692-8541-a02db30da65a`. Opened More actions, then Delete property. Exact warning shown; unavailable-check message visible; Delete disabled. Checked desktop and 390px phone width, with no horizontal overflow. Never pressed Delete. After-stage-change browser recheck remains outstanding; no successful-delete UI flow is claimed.
