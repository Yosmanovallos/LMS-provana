# LMS Provana — Claude Code Contract

## What this is
An evidence-backed career progression engine: learning (paths→programs→courses→lessons),
assessments, evidence review, certifications feed a **Promotion readiness engine** computing
% readiness against versioned, admin-configured RequirementSets. Gamification is engagement
only — points NEVER feed readiness.

## Modules (apps/api/src/modules/)
identity (users, RBAC) · organization (profiles, teams, role/level taxonomy) ·
learning (catalog, enrollment, progress) · assessment (questions, attempts, review) ·
evidence (upload→review workflow) · certification (issuance, expiry) ·
promotion (CORE: requirement sets, completion ledger, readiness snapshots) ·
gamification (point ledger, achievements, leaderboards) · analytics (projections) ·
notification (templates, dispatch) · shared-kernel (Result, events, outbox, base classes)

## Hard rules
1. **No cross-module imports** except from `shared-kernel` and `@lms/contracts`. Cross-context
   communication = domain events via the outbox, or public query services exported in module.md.
2. **Events via outbox**: aggregates collect events; handlers persist state + outbox in one
   unit of work; the dispatcher delivers. Never publish directly from a handler.
3. **All I/O behind ports** (`src/ports/`): FileStoragePort, EmailPort, EventBusPort, AuthPort,
   ClockPort, IdPort. Adapters live in `src/adapters/`. Domain code never imports an adapter.
4. **Append-only ledgers**: completion ledger, point ledger, readiness snapshots, domain_events,
   evidence history — corrections are compensating entries, never updates or deletes.
5. **Idempotency**: every event consumer is idempotent on `sourceEventId`.
6. **Object-level authorization in every handler** — IDs from requests are never trusted;
   manager scope (assigned employees only) is enforced in handlers and tested.
7. New libraries or pattern changes require a DECISIONS.md entry in the same PR.

## Anti-goals
No GraphQL. No microservices. No event sourcing (events complement state). No cross-schema FKs.

## Commands
- `pnpm test` — all tests (Vitest; no DB needed)
- `pnpm --filter @lms/api test` / `pnpm --filter @lms/web build`
- `pnpm lint` · `pnpm build` · `pnpm dev`

## Before working
Backend: read `apps/api/CLAUDE.md` + `docs/modules/<context>.md` for the module you touch.
Frontend: read `apps/web/CLAUDE.md`. Cross-module: `docs/ARCHITECTURE.md`.
Consult `docs/DECISIONS.md` before proposing alternatives. Append gotchas to `docs/MEMORY.md`.
