# Decision Log (ADRs)

ADR-001…006 are ratified in the master plan §6: modular monolith + vertical slices;
buy authn (Clerk→Entra) / own authz; single PG schema-per-context, no cross-schema FKs;
transactional outbox for all domain events; REST+OpenAPI (no GraphQL); promotion
requirements are versioned data, not code.

## ADR-007 — In-memory adapters are the default; Prisma is the swap
**Date:** 2026-06-11. The repo must build, run, and test green with zero external services
(no DB, no Clerk keys). All repositories are interfaces; `InMemory*Repository` implementations
are the DI default and the unit/contract-test substrate. `prisma/schema.prisma` defines the
real multi-schema model; Prisma adapters are selected via `PERSISTENCE=prisma`. This is the
ports-and-adapters discipline applied to our own persistence, and it keeps every Claude Code
session self-verifying.

## ADR-008 — Dev auth adapter for local/demo
**Date:** 2026-06-11. `AUTH_MODE=dev` (default) trusts `x-user-id`/`x-user-role` headers and
seeded personas; `AUTH_MODE=clerk` verifies Clerk JWTs behind the same `AuthPort`. The
frontend ships a persona switcher in dev. No screen or handler knows which adapter is active.

## ADR-009 — Vitest everywhere
**Date:** 2026-06-11. One test runner for api, web, contracts (master plan named Vitest for
api/packages). Domain tests target 90%+ on promotion/assessment/evidence/gamification domain
folders.

## ADR-010 — Tailwind v3 + hand-rolled primitives (no shadcn CLI)
**Date:** 2026-06-11. Stable, offline-friendly; primitives in `apps/web/components/ui`.
