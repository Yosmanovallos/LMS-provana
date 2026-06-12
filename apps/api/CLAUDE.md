# API conventions (NestJS modular monolith)

## Slice anatomy
`src/modules/<ctx>/features/<slice>.ts` — one handler class per use case, framework-free:
constructor-injected repos/ports, a single `execute(input, actor)` returning
`Result<T>` from shared-kernel. Controllers (in `src/app/`) translate HTTP ↔ handler and
NEVER contain logic.

## Module layout
`domain/` aggregates + pure logic (full layering for promotion/evidence/assessment;
lightweight for CRUD-ish modules) · `<ctx>.repositories.ts` repo interfaces + InMemory
impls · `<ctx>.queries.ts` public query service (the ONLY thing other layers may read) ·
`<ctx>.subscriptions.ts` idempotent event consumers · colocated `*.test.ts`.

## Rules
- Errors: `err('not-found'|'forbidden'|'validation'|'conflict'|'invariant', msg)`; no throws
  in domain code. The HTTP filter maps codes → 404/403/400/409/422.
- Events: record on the aggregate (`recordEvent`), publish via `DomainEventPublisher`
  in the handler after saving state. Never `bus.dispatch` directly.
- Every handler does object-level authz: check actor role + ownership/manager scope FIRST.
- Manager scope = `OrgQueries.getTeamMembers(managerId)` exposed via the container — modules
  receive it as an injected function, not an import of the organization module.
- Time/ids only via ClockPort/IdPort. Tests use FixedClock/SequentialIds.
- Tests: Vitest, colocated; build the module via its test factory; assert events via a
  captured outbox/bus, not internals.

## Commands
`pnpm --filter @lms/api test` · `lint` (boundary check + tsc) · `build` · `dev` (port 3001).
