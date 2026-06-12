# Operational Memory

Append gotchas/constraints here; humans prune monthly.

- 2026-06-11 — Windows dev box: use pnpm via corepack (`corepack prepare pnpm@9.15.0 --activate`).
- 2026-06-11 — Tests must not require Postgres/Redis: in-memory adapters are the DI default (ADR-007).
- 2026-06-11 — Event consumers must be idempotent on `sourceEventId`; replaying the outbox is a
  supported operation (analytics/leaderboards rebuild from it).
- 2026-06-11 — `CourseCompleted` fires exactly once per (enrollmentId, courseId) — idempotency
  enforced in ProgressRecord, tested in learning domain tests.
- 2026-06-12 — Boundary lint applies to tests too: module tests must stub neighbors via contract
  events + injected functions (see organization.test.ts), never import another module's factory.
- 2026-06-12 — Prisma datasource blocks reject multi-line arrays; keep `schemas = [...]` on one
  line. Validate with `pnpm dlx prisma@6 validate --schema apps/api/prisma/schema.prisma`
  (needs a dummy DATABASE_URL env var).
- 2026-06-12 — Web build needs no running API: every page reads the persona cookie, so Next
  marks all routes dynamic and never fetches at build time. Keep `cookies()` in `lib/api.ts`.
- 2026-06-12 — API smoke test boots Nest on an ephemeral port and uses built-in fetch — do not
  add supertest (ADR catalog stays lean; new libs need a DECISIONS.md entry).
