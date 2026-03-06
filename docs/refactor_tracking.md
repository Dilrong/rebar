# Refactor Tracking

Last updated: 2026-03-06

## Current Goals

- [completed] Make `records` write paths atomic so record fields and tag links cannot diverge on partial failure.
- [completed] Reuse shared tag validation in `/api/capture/share`.
- [completed] Re-run verification and record any newly found issues.

## Issue Log

- 2026-03-06: `records` create/merge/update still performs record mutation and `record_tags` mutation as separate database calls. This can leave partial state behind when the second call fails. Resolved with SQL RPC functions in `db/migrations/20260306124142_atomic_record_write_functions.sql`.
- 2026-03-06: `/api/capture/share` still validates `tags` and `default_tags` with route-local `z.string().min(1)` rules instead of `TagNameSchema`. Resolved by reusing `TagNameSchema` in the route.
- 2026-03-06: `pnpm install --frozen-lockfile` failed because `pnpm-lock.yaml` still pinned `next` and `next-themes` specifiers to exact versions while `package.json` used caret ranges. Resolved by regenerating `pnpm-lock.yaml` with `pnpm install --lockfile-only`.
- 2026-03-06: No additional blocking issues were found during the follow-up verification pass.

## Verification Log

- 2026-03-06: Previous pass completed `pnpm typecheck`, `pnpm test`, `pnpm lint`, `pnpm build`.
- 2026-03-06: Follow-up pass completed `pnpm typecheck`, `pnpm test` (37 files, 190 tests), `pnpm lint`, `pnpm build`.
- 2026-03-06: Confirmed `pnpm install --frozen-lockfile` failure cause, regenerated `pnpm-lock.yaml`, and re-ran frozen install verification.
