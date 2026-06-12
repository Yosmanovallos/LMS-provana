# Architecture

Source of truth: `LMS-Architecture-Implementation-Master-Plan.md` (§4–§6). This page tracks the
implemented state.

## Topology (MVP)

- `apps/web` — Next.js 15 App Router. Server components for reads, typed client from
  `@lms/contracts`. Route groups: `(employee)`, `(manager)`, `(admin)`.
- `apps/api` — NestJS modular monolith. One process; modules are bounded contexts.
  REST + OpenAPI. In-process event bus with transactional outbox.
- Persistence: Postgres schema-per-context via Prisma (`apps/api/prisma/schema.prisma`).
  **Default runtime/test adapter is in-memory** (no DB required); Prisma adapters are the
  production swap, selected with `PERSISTENCE=prisma`.

## Event flow (transactional outbox)

1. A feature handler loads aggregates, executes domain logic; aggregates collect events.
2. The handler saves state and appends events to the outbox **in one unit of work**.
3. `OutboxDispatcher` delivers pending events to in-process subscribers (and later to
   Service Bus — same seam). Every consumer is idempotent on `sourceEventId`.
4. `domain_events` is append-only: it is the audit trail and the replay source for
   Analytics projections and leaderboard rebuilds.

## Ports & adapters

| Port | MVP adapter (default) | Production adapter | Azure adapter (slot) |
|---|---|---|---|
| `AuthPort` | `DevAuthAdapter` (x-user-id/x-user-role headers) | `ClerkAuthAdapter` (JWT verify) | Entra ID OIDC |
| `FileStoragePort` | `LocalFileStorageAdapter` | Cloudinary signed URLs | Blob SAS |
| `EmailPort` | `ConsoleEmailAdapter` | Resend | ACS/SendGrid |
| `EventBusPort` | `InProcessEventBus` | same | Service Bus topics |
| `OutboxStore` | `InMemoryOutboxStore` | `PrismaOutboxStore` | same (PG) |
| `ClockPort` / `IdPort` | system clock / crypto.randomUUID | same | same |

Authorization is **ours** regardless of auth adapter: permission catalog in shared-kernel,
`PermissionsGuard` on every controller route, manager-scope checks in handlers.

## Context map

Identity → Organization → Learning → (events) → Assessment/Evidence/Certification → Promotion.
Gamification, Analytics, Notification are pure event consumers. Promotion never reads other
modules' state — it maintains its own CompletionLedger fed by events (independently auditable
and extractable).

## Boundary enforcement

ESLint `no-restricted-imports` per module + review checklist: a module may import only from
itself, `shared-kernel`, `@lms/contracts`, and `src/ports`. No cross-schema FKs in Prisma.
