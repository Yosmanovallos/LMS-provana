# Operational Memory

Append gotchas/constraints here; humans prune monthly.

- 2026-06-11 — Windows dev box: use pnpm via corepack (`corepack prepare pnpm@9.15.0 --activate`).
- 2026-06-11 — Tests must not require Postgres/Redis: in-memory adapters are the DI default (ADR-007).
- 2026-06-11 — Event consumers must be idempotent on `sourceEventId`; replaying the outbox is a
  supported operation (analytics/leaderboards rebuild from it).
- 2026-06-11 — `CourseCompleted` fires exactly once per (enrollmentId, courseId) — idempotency
  enforced in ProgressRecord, tested in learning domain tests.
