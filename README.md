# LMS Provana — Learning Management & Professional Growth Platform

An evidence-backed career progression engine with a learning system feeding it. Built per the
[Architecture & Implementation Master Plan](./LMS-Architecture-Implementation-Master-Plan.md).

## Architecture

**Modular monolith** (NestJS) with 10 bounded-context modules communicating through an
in-process event bus backed by a transactional outbox. **Next.js 15** frontend.
Ports & adapters at every infrastructure boundary (auth, storage, email, eventing) so the
MVP stack (Clerk/Cloudinary/Resend/Neon) can be swapped for Azure (Entra/Blob/ACS/Service Bus)
without touching domain code.

```
apps/
  api/   NestJS modular monolith — modules/{identity,organization,learning,assessment,
         evidence,certification,promotion,gamification,analytics,notification,shared-kernel}
  web/   Next.js 15 App Router — (employee)/(manager)/(admin) route groups
packages/
  contracts/  event schemas (zod), DTOs — the only package both apps import
docs/
  modules/    one-page contract per bounded context
  plans/      spec-driven implementation plans per phase
```

## Getting started

```bash
pnpm install
pnpm test        # all unit + contract tests (no DB required — in-memory adapters)
pnpm dev         # api on :3001, web on :3000
```

The API runs with in-memory persistence and dev auth by default (`AUTH_MODE=dev`,
`x-user-id`/`x-user-role` headers). Set `DATABASE_URL` (Neon/Postgres) and run
`pnpm --filter api db:migrate` to use Prisma persistence. See `docs/ARCHITECTURE.md`.

## Documentation

- `CLAUDE.md` — hard rules and conventions (the contract for every Claude Code session)
- `docs/ARCHITECTURE.md` — topology, context map, port/adapter inventory
- `docs/DECISIONS.md` — ADR log
- `docs/modules/<context>.md` — per-context contracts (events in/out, queries, invariants)
- `docs/plans/` — per-phase implementation plans (flows, files, tests, acceptance criteria)
- `docs/TASKS.md` — backlog as slices with acceptance criteria
