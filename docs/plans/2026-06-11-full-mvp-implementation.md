# LMS Provana Full MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the entire master plan MVP — a NestJS modular monolith (10 bounded
contexts, transactional outbox event bus) + Next.js 15 frontend + contracts package, fully
unit/contract-tested without external services, pushed to GitHub.

**Architecture:** Modular monolith with vertical slices; clean-architecture layering on core
domains (promotion, evidence, assessment); ports & adapters for all I/O; in-memory adapters
as DI default (ADR-007) with Prisma schema as the production swap. Domain events flow
aggregate → outbox → in-process dispatcher → idempotent consumers.

**Tech Stack:** TypeScript 5.x, NestJS 11, Next.js 15, zod, Vitest, Prisma (schema only by
default), pnpm workspaces + Turborepo, Tailwind, GitHub Actions.

**Spec:** `LMS-Architecture-Implementation-Master-Plan.md`; per-context contracts in
`docs/modules/*.md` (events, queries, invariants — normative for each phase below).

---

## Phase 0 — Foundation

**Files:** root `package.json`/`pnpm-workspace.yaml`/`turbo.json`/`tsconfig.base.json`;
`packages/contracts/src/{events/*,dto/*,index.ts}`; `apps/api/src/modules/shared-kernel/
{result.ts,domain-event.ts,aggregate-root.ts,event-bus.ts,outbox.ts,clock.ts,ids.ts,
permissions.ts}`; `apps/api/src/ports/*.ts`; `apps/api/src/adapters/{in-memory,local,console}/*`;
`.github/workflows/ci.yml`; vitest configs.

**Flows:** (1) aggregate records event → unit-of-work saves + appends outbox → dispatcher
delivers to subscribed handler → handler marks processed (idempotency). (2) contracts: every
event type has a zod schema + TS type; publishers validate on append.

- [x] Scaffold workspaces; `pnpm install` succeeds
- [x] contracts: 22 event schemas (master plan §8 catalog) + shared DTO types; tests validate
      sample payloads and reject malformed ones
- [x] shared-kernel: `Result<T,E>`, `DomainEvent`, `AggregateRoot.pullEvents()`,
      `InMemoryOutboxStore`, `InProcessEventBus` (subscribe by type, sync dispatch, per-
      consumer idempotency ledger), permission catalog
- [x] **Outbox round-trip test green** (exit criterion): event appended → dispatched → consumer
      received exactly once even when dispatch runs twice
- [x] CI workflow: install, lint, test, build
- [x] Commit

## Phase 1 — Identity, AuthZ, Organization

**Slices:** identity/{register-user, assign-role, list-users}; organization/{sync-profile
(consumes UserRegistered), assign-manager, change-job-level, manage-teams, role-level taxonomy}.
**Tests:** unique email/externalAuthId; role change emits RoleAssigned; profile auto-created on
UserRegistered; manager must hold manager/admin role; levelHistory append-only;
getTeamMembers returns only managed profiles. Acceptance: 3 personas resolvable; manager
scope query works.

## Phase 2 — Learning

**Slices:** learning/{author-course (draft→publish, versioning), author-path/program,
enroll-user (manual + auto by role-level), complete-lesson, my-learning query}.
**Tests:** enroll only published; progress only on active enrollment; lesson completion
idempotent; percentComplete math; CourseCompleted exactly-once (double completion of last
lesson does not re-emit); auto-enroll on RoleAssigned→path targeting role-level;
my-learning buckets (todo/active/completed). Acceptance: seedable catalog; EPAM-style
My Learning data shape served.

## Phase 3 — Assessment

**Slices:** assessment/{author-assessment, start-attempt, submit-attempt (auto-score MC,
queue open/practical), review-attempt, review-queue query}.
**Tests:** maxAttempts enforced; MC auto-scoring correct (multi-select exact match); mixed
assessment → awaiting-review; reviewer must be manager-of-user or admin; finalized score
immutable; pass/fail threshold edge (score == passing passes); fail review requires feedback.

## Phase 4 — Evidence

**Slices:** evidence/{submit-evidence (file ref via FileStoragePort), start-review, decide
(approve/reject), resubmit, review-queue query}.
**Tests:** full state machine; only assigned manager/admin decides; rejection requires
feedback; approved immutable; resubmission links resubmissionOf and new item starts fresh;
history records every transition; mime/size validation; visibility (owner/manager/admin only).

## Phase 5 — Certification + Analytics v1

**Slices:** certification/{issue-on-event consumers, expire-certifications job, registry query};
analytics/{projection handlers, rebuild, dashboard queries}.
**Tests:** idempotent issuance per (userId, source, refId); expiry transitions once; analytics
projections compute documented metrics; **rebuild from event log equals incremental state**.

## Phase 6 — Gamification

**Slices:** gamification/{award-points consumers, configure-rules, recognition, achievements,
materialize-leaderboards job, queries}.
**Tests:** idempotent on sourceEventId (replay same event → one award); rule config drives
points; daily cap; achievement granted once; leaderboard ranking with ties; period bucketing
(weekly/monthly/quarterly/annual) and team scope; points never appear in promotion module
(boundary test: no import — enforced by lint).

## Phase 7 — Promotion engine (CORE)

**Slices:** promotion/{manage-requirement-sets (versioning), ledger-ingestion consumers,
recalculate-readiness, gap-report query, team-readiness query}.
**Tests:** readiness math with weights (82% scenario from master plan §7.7 reproduced:
QA Junior→Mid, missing course+assessment+cert named); ledger idempotency; editing active set
creates v(n+1) and old snapshots keep old version; PromotionEligible fires once on first 100%;
TenureRequirement months computation; JobLevelChanged re-targets set.

## Phase 8 — Notifications

**Slices:** notification/{event consumers per mapping table, templates, preferences, inbox,
mark-read}.
**Tests:** each of the 5 mapped event types produces correct recipient+template on both
channels; disabled preference → skipped record; email failures recorded not thrown;
template var substitution; unread count; only owner marks read.

## API wiring + Prisma + seed

REST controllers per slice with OpenAPI decorators; `PermissionsGuard` + dev-auth middleware;
global exception filter mapping Result errors → HTTP; multi-schema `prisma/schema.prisma`
(10 schemas + infra.domain_events); `scripts/seed.ts` creating the demo scenario (3 personas,
QA path, mixed assessment, requirement set, 82% readiness user). Smoke test: boot Nest app
in-memory, hit health + a golden path.

## Frontend (Next.js 15)

Route groups `(employee)` my-learning (ToDo/Active/History/Certificates tabs), course tree,
assessments, evidence, achievements+leaderboard, career (readiness gap);
`(manager)` team, review queues (evidence/assessments), team readiness, analytics;
`(admin)` catalog builder, requirement sets, gamification config, users, audit.
Sidebar shell per reference UX; typed API client; dev persona switcher. Build must pass.

## Final verification

`pnpm -r test` green; `pnpm lint` clean; `pnpm build` (api + web) succeeds; push to
origin/main; remote verified.
