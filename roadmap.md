# Resolve roadmap

## Active Owner acceptance (complete)
- [x] Fresh demo owner invite redemption (Riley Alder, code QATP-7742, redeemed by a new account)
- [x] Activate Riley's demo program clock (started 2026-08-01, ends 2026-10-29)
- [x] Sign-out / sign-in persistence check
- [x] Submit -> approve, and return -> correct -> approve, no double counting
- [x] Duplicate correction prevented (returned entry shows "Corrected already", no second correction)
- [x] Hours labels: "Reported hours" (pending + approved) vs "ARHA-approved hours"


## New: downloadable Hours & Participation Report (owner self-serve)
- [x] Server-side report builder from saved participation records (owner-scoped)
- [x] In-progress "Progress report" + automatic end-of-window final report (reuse 90-day clock)
- [x] Branded PDF + CSV of time-entry detail, server-generated, no public links
- [x] Totals split: approved / awaiting review / returned-superseded, with explanations
- [x] Shared-property entries counted once, attribution explained
- [x] Outside-period entries listed separately
- [x] Demo validation: in-progress, ended program, post-correction totals, second-owner denial, PDF/CSV match portal

## Breezeway
- [x] Webhook label fix (task lookup failures, not signature failures)
- Fitzgerald-only preview processing stays unchanged

## PR review (Claude PR #1 — Breezeway webhook recovery)
- [x] Reviewed in isolated scratch copy: patch applies, 37/37 tests pass, build passes
- [ ] Blocker: 4 typecheck errors introduced (2 exactOptionalPropertyTypes, 2 missing bun:test types)
- [ ] Migration must be applied BEFORE the code ships (recordEvent writes the new retryable column)
- Not merged, migration not applied, nothing published

## PR review round 2 (head 062eb47)
- [x] Manifest + head confirmed; patch applies clean over current HEAD (only roadmap.md overlaps)
- [x] Full typecheck / production build / 46 tests run in isolated scratch copy
- [x] Migration + concurrent-duplicate constraint verified on a disposable local Postgres (not the live DB)
- [x] Resolved (head 4569800): global bun reference replaced with a scoped `declare module "bun:test"`; full typecheck clean, 46/46 tests, production build passes in the isolated copy
- Not merged, nothing published, no events replayed

## PR review round 3 (head 4569800)
- [x] Only bun.lock / package.json / src/lib/__tests__/bun-env.d.ts changed; all other PR files byte-identical to round 2
- [x] Migration `20260828193000_...sql` APPLIED to the live database (additive columns + indexes; published receiver unaffected)
- [ ] Awaiting merge/sync + publish of the receiver code
- Do NOT run "Retry failed lookups" as release verification — needs separate approval

