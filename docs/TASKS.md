# Backlog (slices with acceptance criteria)

Phases 0–8 + API wiring + frontend are tracked in
`docs/plans/2026-06-11-full-mvp-implementation.md` (normative). This file lists post-MVP
follow-ups.

## Deferred / next
- [x] e2e: Playwright golden journeys against `pnpm dev` (8 journeys, master plan §15) —
      `pnpm e2e` (packages/e2e, ADR-011)
- [ ] integration: Testcontainers Postgres run of Prisma adapters; outbox dispatch lag metric
- [ ] adapters: ClerkAuthAdapter JWT verification (needs keys), Resend EmailAdapter,
      Cloudinary FileStorageAdapter — slots exist in `apps/api/src/adapters/`
- [ ] worker: move outbox dispatch + leaderboard/expiry jobs to BullMQ when Redis available
- [ ] observability: pino + OTel wiring, Sentry DSNs
- [ ] Phase 9 (Azure): Bicep landing zone, Service Bus adapter, Blob adapter, Entra cutover
      (master plan §20 runbook)
