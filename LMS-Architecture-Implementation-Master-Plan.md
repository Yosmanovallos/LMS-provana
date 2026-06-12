# Enterprise Learning Management & Professional Growth Platform
## Architecture & Implementation Master Plan

**Version:** 1.0 · **Date:** June 2026 · **Status:** Approved for Phase 0
**Reference UX:** EPAM Learn / EPAM Campus (sidebar navigation, My Learning hub with ToDo/Active/History/Certificates tabs, Program → Module → Course → Lesson hierarchy with per-item grading, courseware tree with completion tracking)

---

# 1. Executive Summary

This document is the single source of truth for building a Learning Management & Professional Growth Platform ("the Platform") in two deliberate stages:

- **Stage 1 (MVP, weeks 1–14):** A modular monolith deployed on free/low-cost services (Vercel + Railway + Neon + Clerk + Cloudinary + Resend + Sentry), built feature-by-feature with Claude Code, costing **~$25–45/month**.
- **Stage 2 (Enterprise, month 6+):** The same codebase containerized and migrated to **Azure Container Apps + Azure PostgreSQL Flexible Server + Entra ID + Service Bus + Blob Storage**, with zero rewrite — only adapter swaps at well-defined ports.

**The three decisions everything else follows from:**

1. **Modular Monolith with Vertical Slices** — one deployable, eight isolated domain modules communicating through an in-process event bus. This is the only architecture that is simultaneously cheap to run, fast for Claude Code to build (small, isolated context per feature), and structurally pre-decomposed for future extraction into services.
2. **Ports & Adapters at every infrastructure boundary** — auth, storage, email, eventing, and observability are accessed through interfaces. MVP adapters (Clerk, Cloudinary, Resend, in-process bus) are swapped for Azure adapters (Entra ID, Blob, ACS/SendGrid, Service Bus) without touching domain code. This is the entire migration strategy.
3. **Documentation-as-context for Claude Code** — a strict `CLAUDE.md` + per-module docs + skills library regime that keeps every Claude Code session scoped to one bounded context, cutting token consumption by 60–75% versus naive whole-repo prompting.

**Critical risks (full analysis in §19):** promotion-rule complexity creep, evidence-review bottlenecks at managers, and gamification gaming. All three are mitigated by design decisions in the domain model, not by code.

---

# 2. Product Analysis

## 2.1 What this product actually is

Strip away the modules and the Platform is an **evidence-backed career progression engine** with a learning system feeding it. The reference screenshots confirm this framing: the EPAM-style UX centers on *My Learning* (what I must do, what I'm doing, what I've proven) and *Career Journey* (where I'm going). Everything else — courses, assessments, gamification — exists to produce **trustworthy signals for promotion decisions**.

This reframing matters architecturally:

- The **Promotion Readiness engine is the core domain** (the differentiator). Learning delivery is a *supporting* domain — important, but commoditized (any LMS does it).
- **Auditability is a first-class requirement**, not a security afterthought. If promotions are decided on platform data, every grade, approval, and rule change must be traceable. This pushes us toward domain events + an append-only audit trail from day one.
- **Manager trust workflows** (evidence approval, assessment review) are the human-in-the-loop bottleneck. UX and notification design must optimize manager throughput, or the system silently fails.

## 2.2 Product tensions to resolve early

| Tension | Resolution |
|---|---|
| Gamification (engagement) vs. promotion fairness (rigor) | Two separate scoring systems. Gamification points NEVER feed readiness %. Readiness is computed only from completions, passed assessments, certifications, and approved evidence. |
| Flexible role/level paths vs. rule explosion (8 roles × 4 levels × custom roles) | Promotion requirements are **data, not code**: a versioned `RequirementSet` per (role, level) pair, configured by admins. The engine evaluates rules generically. |
| Manager autonomy vs. consistency | Managers approve evidence and review assessments; only admins define what counts toward promotion. |
| Real-time leaderboards vs. cheap infra | Leaderboards are materialized periodically (per period: weekly/monthly/quarterly/annual), not computed live. Eventual consistency is acceptable here. |

## 2.3 Non-functional priorities (ranked)

1. **Correctness & auditability** of progress, grades, and readiness data
2. **Claude Code buildability** — small modules, explicit contracts, conventional stack
3. **Migration optionality** — nothing that locks us out of Azure
4. **Cost** — near-zero until proven
5. Performance/scale — irrelevant at MVP (hundreds of users); designed-for but not optimized-for

---

# 3. Business Domains & Bounded Contexts

## 3.1 Domain classification (DDD strategic design)

**Core domains** (competitive differentiator — build with most care):
- **Promotion** — readiness calculation, requirement sets, gap analysis
- **Evidence** — upload → review → approve/reject workflow with feedback

**Supporting domains** (necessary, custom, but not differentiating):
- **Learning** — study paths, programs, courses, modules, lessons, enrollment, progress
- **Assessment** — quiz/open/practical delivery, attempts, scoring, manual review
- **Certification** — issuance, expiry, registry
- **Gamification** — points, achievements, leaderboards
- **Analytics** — read-model projections, dashboards
- **Organization** — departments, teams, role/level taxonomy, manager assignments

**Generic domains** (buy/adopt, never build):
- **Identity & Access** — authentication (Clerk → Entra ID), session management
- **Notification** — multi-channel dispatch (Resend → ACS; Teams/Slack later)

## 3.2 Bounded contexts and ownership

| # | Context | Owns | Publishes (events) | Consumes |
|---|---|---|---|---|
| 1 | **Identity & Access** | Users (auth identity), roles (RBAC), permissions, sessions | `UserRegistered`, `RoleAssigned` | — |
| 2 | **Organization** | Employee profiles, departments, teams, manager links, job role × level taxonomy | `EmployeeAssignedToManager`, `JobLevelChanged` | `UserRegistered` |
| 3 | **Learning** | Study paths, programs, courses, modules, lessons, enrollments, progress | `CourseCompleted`, `PathCompleted`, `EnrollmentCreated`, `LessonCompleted` | `RoleAssigned` (auto-assign paths) |
| 4 | **Assessment** | Assessments, questions, attempts, scores, review queue | `AssessmentPassed`, `AssessmentFailed`, `AttemptSubmitted` | `EnrollmentCreated` |
| 5 | **Evidence** | Evidence items, files (refs), review workflow, feedback | `EvidenceSubmitted`, `EvidenceApproved`, `EvidenceRejected` | — |
| 6 | **Certification** | Certificates (internal + external), validity, registry | `CertificationEarned`, `CertificationExpired` | `AssessmentPassed`, `EvidenceApproved`, `CourseCompleted` |
| 7 | **Promotion** | Requirement sets (versioned), readiness snapshots, gap reports | `ReadinessRecalculated`, `PromotionEligible` | `CourseCompleted`, `AssessmentPassed`, `CertificationEarned`, `EvidenceApproved`, `JobLevelChanged` |
| 8 | **Gamification** | Point ledger, achievements, leaderboard projections | `PointsAwarded`, `AchievementUnlocked` | `CourseCompleted`, `AssessmentPassed`, `CertificationEarned`, `ManagerRecognitionGiven` |
| 9 | **Analytics** | Read-only projections: completion rates, velocity, team progress, skill coverage | — | *all events* (projection builder) |
| 10 | **Notification** | Templates, preferences, dispatch log | `NotificationSent` | *subscribed events* |

**Boundary rules (enforced, see §10):**
- A context owns its tables; **no cross-context SQL joins or foreign keys** across schemas. Cross-context reads go through a public query interface or projection.
- Contexts share only **IDs and published contracts** (event payloads + query DTOs in `packages/contracts`).
- Promotion never reads Learning's tables; it maintains its own *completion ledger* fed by events. This makes the core domain independently extractable and trivially auditable.
- Identity is upstream of everything (Conformist relationship); Analytics is downstream of everything (pure consumer).

## 3.3 Context map (relationships)

```
Identity ──(upstream/conformist)──▶ Organization ──▶ Learning
                                         │              │ events
                                         ▼              ▼
                                     Promotion ◀── Assessment / Evidence / Certification
                                         │
                                         ▼ events
                  Gamification ◀──┐  Analytics ◀── (all)   Notification ◀── (subscribed)
```

---

# 4. Recommended MVP Architecture

## 4.1 Service selections & reasoning

| Concern | **Choice** | Runner-up | Reasoning |
|---|---|---|---|
| Frontend | **Vercel** (Next.js 15, App Router) | Netlify | First-class Next.js support, preview deployments per PR (pairs with Neon branching), generous Hobby tier, edge network. Netlify is fine but Next.js support is second-class. |
| Backend | **Railway** (NestJS, Docker) | Render | Railway: always-on (no cold-start spin-down like Render's free tier — fatal for demos), Dockerfile-native (the Dockerfile IS the Azure Container Apps migration artifact), built-in cron + private networking, ~$5–10/mo. Fly.io is powerful but operationally heavier for no MVP benefit. |
| Database | **Neon PostgreSQL** | Supabase | Neon's killer feature for this project: **database branching** — each PR/preview gets an instant copy-on-write DB branch, which pairs with Vercel previews and lets Claude Code test migrations safely. Scale-to-zero free tier. Plain vanilla Postgres = cleanest path to Azure PostgreSQL Flexible Server (pg_dump/restore or logical replication, zero schema changes). Supabase bundles auth+storage but couples three concerns to one vendor and its auth model migrates worse to Entra. |
| Auth | **Clerk** | Auth.js | Clerk: production-grade UI components (sign-in, org management, user profiles) that save 2–3 weeks of frontend work, built-in organizations + custom roles (maps directly to our RBAC), MFA, session management, generous free tier (10k MAU). Auth.js is free but you build every screen and edge case yourself — wrong trade for an MVP. **Mitigation for lock-in:** all access decisions go through our own `AuthorizationService` port; Clerk only authenticates. |
| File storage | **Cloudinary** | Supabase Storage | Handles the evidence mix (PDF, DOCX, images, certificates) with on-the-fly image transforms for thumbnails, signed upload/download URLs, malware-safe delivery. 25 free credits ≈ plenty for demo. Accessed only via our `FileStoragePort` → swap to Blob Storage is one adapter. |
| Email | **Resend** | SendGrid | Best DX in the category, React Email templates (same component model as the frontend), 3k emails/mo free. SendGrid's free tier and dashboard are clunkier. Behind `EmailPort`. |
| Monitoring | **Sentry** | Better Stack | Error tracking + performance tracing + session replay in one, deep Next.js/NestJS SDKs, source-map support. Better Stack is better at uptime/logs but weaker at error intelligence — add its free uptime monitor as a complement if desired. |

## 4.2 MVP topology

```
┌─────────────── Vercel ───────────────┐      ┌─────────── Railway ───────────┐
│ Next.js 15 (App Router)              │ HTTPS│ NestJS Modular Monolith       │
│ - Server Components for reads        │─────▶│ /modules/{8 bounded contexts} │
│ - Clerk components (auth UI)         │ REST │ - In-process event bus        │
│ - Tailwind + shadcn/ui               │+JWT  │ - BullMQ worker (same image)  │
└──────────────────────────────────────┘      │ - Prisma → Neon               │
        │                                     └───────┬───────────┬───────────┘
        ▼                                             ▼           ▼
   Clerk (authn)                               Neon Postgres   Redis (Railway)
                                               (schema-per-    (queues, cache,
   Cloudinary (files)  Resend (email)           context)        leaderboards)
   Sentry (errors/APM across both apps)
```

**Key MVP decisions:**
- **One NestJS app, one Postgres database, schema-per-bounded-context** (`learning.*`, `promotion.*`, …). Logical isolation now; physical extraction later if ever needed.
- **In-process event bus** with a `domain_events` outbox table (transactional outbox pattern). Events are persisted in the same transaction as the state change, then dispatched to in-process handlers and BullMQ jobs. This gives us: audit log for free, replayability for Analytics projections, and a 1:1 conceptual map to Azure Service Bus later.
- **BullMQ on Railway Redis** for async work: notification dispatch, readiness recalculation, leaderboard materialization, certificate generation.
- **REST API with OpenAPI** generated from NestJS decorators; typed client generated into `packages/contracts` for the frontend. (REST over GraphQL: simpler for Claude Code, simpler to secure, sufficient for known UIs.)

---

# 5. Recommended Azure Enterprise Architecture

## 5.1 Selections & reasoning

| Concern | **Choice** | Why this, not the alternatives |
|---|---|---|
| Compute | **Azure Container Apps (ACA)** | The monolith already ships as a Docker image — ACA runs it unchanged with autoscaling (KEDA, incl. scale-on-Service-Bus-queue for the worker), revisions/blue-green, and no cluster ops. **App Service** ties us to its model and makes later service extraction awkward; **AKS** is unjustifiable ops burden until we have a platform team and >5 independently scaled services. ACA is the explicit middle path and the natural landing zone for extracted services later. |
| Database | **Azure Database for PostgreSQL — Flexible Server** | We are already Postgres (Neon). Zero schema/ORM changes, migrate via pg_dump or logical replication. Azure SQL would force a dialect + Prisma provider migration for no benefit. Use zone-redundant HA in prod, PgBouncer built-in. |
| Storage | **Azure Blob Storage** (Hot tier + lifecycle to Cool) | Evidence files, certificates, exports. SAS-token signed URLs replace Cloudinary signed URLs behind the same `FileStoragePort`. Add Microsoft Defender for Storage for malware scanning of uploads. |
| Identity | **Entra ID** (workforce) | This is an *employee* platform — Entra ID gives SSO with the corporate directory, conditional access, group→role sync, SCIM provisioning. **Entra External ID only if** contractors/partners outside the tenant must log in (keep as an extension, not the default). Clerk is retired; our `AuthorizationService` and user tables remain untouched. |
| Messaging | **Service Bus (primary) + Event Grid (edge)** | Service Bus topics/subscriptions replace the in-process bus for inter-module/async events: ordering (sessions), dead-lettering, retries — required for promotion/audit correctness. Event Grid only for Azure-native triggers (Blob-created → virus-scan/ingest pipeline) and future webhook fan-out to Teams/Slack. Don't use Event Grid for domain messaging (no ordering/DLQ semantics we need). |
| Secrets | **Azure Key Vault** | All connection strings, API keys; surfaced to ACA via managed identity + Key Vault references. No secrets in env files or pipelines. |
| Monitoring | **Azure Monitor + Application Insights** | OpenTelemetry SDK in the app from MVP day one (exported to Sentry initially) means flipping the OTel exporter to App Insights is a config change. Log Analytics workspace for centralized logs, workbooks for ops dashboards. Sentry may be retained for error grouping if desired — they coexist. |
| CI/CD | **GitHub Actions** (+ Azure DevOps Boards optional) | The repo lives on GitHub (best Claude Code + PR-review integration). GHA with OIDC federation to Azure (no stored credentials) handles build→ACR→ACA. Adopt Azure DevOps *Boards* only if the org mandates it for planning; do not split CI across two systems. |

## 5.2 Enterprise topology

```
            Azure Front Door + WAF
                     │
      ┌──────────────┴───────────────┐
      ▼                              ▼
Static Web App / ACA (Next.js)   ACA: API (NestJS monolith)
                                     │  managed identity
      ┌───────────┬─────────────┬────┴──────┬─────────────┐
      ▼           ▼             ▼           ▼             ▼
 PostgreSQL    Blob Storage  Service Bus  Key Vault   Azure Cache
 Flexible Srv  (+Defender)   (topics)                 for Redis
      ▲                          │
      │                          ▼
      └────────────── ACA: Worker (same image, KEDA scale on queue depth)

 Entra ID (SSO, groups→roles)   App Insights + Log Analytics (OTel)
 ACR (images)                   GitHub Actions (OIDC → ACR → ACA)
```

**Network posture:** all data services behind Private Endpoints in a VNet; ACA environment VNet-integrated; public ingress only via Front Door/WAF.

---

# 6. Architecture Decision Records

## ADR-001 — Application architecture style

| Style | Pros | Cons | Verdict |
|---|---|---|---|
| **Modular Monolith** | One deployable (cheap, simple ops); in-process calls (no distributed-systems tax); refactoring across modules is an IDE operation; enforced module boundaries give 80% of microservice benefits; ideal Claude Code unit of work | Single runtime blast radius; one tech stack; requires discipline (boundary enforcement) to avoid big-ball-of-mud | ✅ **MVP and initial Enterprise** |
| Microservices | Independent deploy/scale; team autonomy; fault isolation; per-service tech freedom | Distributed transactions, eventual consistency everywhere, network failure modes, observability burden, 10× infra cost & ops; absurd for 1 team + Claude Code; cross-cutting changes span repos | ❌ Premature. Revisit per-module when a module demonstrably needs independent scaling or a dedicated team (most likely first: Analytics, Notification) |
| Event-Driven Architecture | Decoupling between contexts; audit trail; replayable projections; async by default fits notifications/analytics/gamification | Harder to reason about flows; eventual consistency UX issues; needs idempotency + outbox discipline | ✅ **As an internal pattern, not a topology**: domain events + outbox from day one (in-process MVP → Service Bus enterprise). Not full event-sourcing — too costly for this team size; events complement state, don't replace it |
| Clean Architecture | Dependency rule protects domain from infra; testable core; enables the adapter-swap migration | Ceremony (layers, mappers) can be over-applied; slows simple CRUD | ✅ **Applied at module level, proportionally**: full layering for core domains (Promotion, Evidence, Assessment); lightweight (handler→Prisma) for CRUD-ish modules (Organization, Catalog admin) |
| Vertical Slice Architecture | Each feature = one folder (request→handler→response); minimal cross-feature coupling; **the single biggest Claude Code token saver** — a slice is a complete, self-contained context | Shared-logic duplication risk; needs conventions to stay consistent | ✅ **Within each module**: modules = bounded contexts, slices = features inside them |

**ADR-001 Decision:** *Modular Monolith of 8–10 bounded-context modules; Vertical Slices within modules; Clean Architecture dependency rule applied proportionally; domain events via transactional outbox from day one.* The same architecture serves MVP and Enterprise — only the adapters and the event transport change. This is deliberate: **the migration is a re-platform, not a re-architecture.**

## ADR-002 — Buy authentication (Clerk) for MVP, Entra ID for enterprise; own authorization always
Authentication is generic-domain — never build. Authorization (role→permission→resource) is ours, implemented behind an `AuthorizationService`, with Clerk/Entra only supplying verified identity + group claims.

## ADR-003 — Single Postgres, schema-per-context, no cross-schema FKs
Physical simplicity, logical separation, future extractability, one backup story.

## ADR-004 — Transactional outbox for all domain events
Guarantees no lost events (promotion/audit correctness), provides the audit log, and maps 1:1 to Service Bus later.

## ADR-005 — REST + OpenAPI + generated typed client (no GraphQL)
Known first-party UIs, simpler authz surface, lower Claude Code complexity.

## ADR-006 — Promotion requirements are versioned data, not code
Admins compose `RequirementSet`s; the engine evaluates generically. New roles/levels require zero deployments. Readiness snapshots reference the requirement-set *version* used — decisions stay auditable even after rules change.

---

# 7. Domain Model (key aggregates per context)

Notation: **Aggregate Root** · entity · *value object* · → relationship · ⚡ event

## 7.1 Identity & Access
- **User** — externalAuthId (Clerk/Entra subject), email, status · *Role* (Employee | Manager | Admin) · *PermissionSet* ⚡ UserRegistered, RoleAssigned
- Invariant: a User's platform role is independent of org job role (a Manager is an access role; "QA" is a job role in Organization).

## 7.2 Organization
- **EmployeeProfile** — userId, displayName, department → Team, managerId, *JobRole* (QA, RPA Dev, BA, PM, Dev, DevOps, SM, PO, custom…), *JobLevel* (Junior|Mid|Senior|Lead), levelHistory[] ⚡ EmployeeAssignedToManager, JobLevelChanged
- **Team** — name, departmentId, members[]
- *JobRole* and *JobLevel* form the **RoleLevel key** `(roleId, levelId)` referenced by Learning paths and Promotion requirement sets. Custom roles = new rows, not new code.

## 7.3 Learning (catalog + enrollment)
- **StudyPath** — targets *RoleLevel*, ordered PathItems (→ Course | Program | Assessment ref), status (draft/published/archived), version
- **Program** — grouping of courses with schedule windows (matches screenshot: program → modules → courses with start/end dates)
- **Course** — modules[] → Module — lessons[] → Lesson (*content ref*, type: video|reading|exercise, duration) · completionRule (*all-lessons* | *quiz-pass*)
- **Enrollment** — userId, target (path/program/course), source (assigned|self), assignedBy, dueDate, status ⚡ EnrollmentCreated
- **ProgressRecord** — per enrollment: lessonCompletions[], percentComplete, completedAt ⚡ LessonCompleted, CourseCompleted, PathCompleted
- Invariants: progress only on active enrollment; CourseCompleted fires exactly once (idempotency key = enrollmentId+courseId).

## 7.4 Assessment
- **Assessment** — type-mixed questions[] (entity Question: *MultipleChoice* | *OpenText* | *PracticalExercise*), *PassingCriteria* (score %, maxAttempts), linked to course/path/requirement
- **Attempt** — userId, assessmentId, answers[], *Score*, status (in-progress|auto-scored|awaiting-review|passed|failed), reviewerId, feedback ⚡ AttemptSubmitted, AssessmentPassed/Failed
- Invariants: attempts ≤ maxAttempts; open/practical answers require manager/admin review before final score; score immutable once finalized.

## 7.5 Evidence
- **EvidenceItem** — userId, targetRequirementId?, *FileRef* (storage key, mime, size, checksum), description, status: Submitted → UnderReview → Approved | Rejected, review (reviewerId, decidedAt, *Feedback*), resubmissionOf? ⚡ EvidenceSubmitted/Approved/Rejected
- Invariants: only the assigned manager (or admin) may decide; rejection requires feedback; approved items are immutable; full state-transition history retained (audit).

## 7.6 Certification
- **Certification** — userId, *CertificationType* (internal | external), source (assessment | course | evidence | manual), issuedAt, expiresAt?, *VerificationRef* ⚡ CertificationEarned, CertificationExpired

## 7.7 Promotion (core)
- **RequirementSet** — for *RoleLevel* transition (e.g., QA Junior → QA Mid), **versioned**, effectiveFrom; requirements[]: entity Requirement (*CourseRequirement* | *AssessmentRequirement* | *CertificationRequirement* | *EvidenceRequirement* | *TenureRequirement*), each with weight
- **CompletionLedger** — per user: append-only facts ingested from events (courseCompleted, assessmentPassed, certEarned, evidenceApproved) with source event id — Promotion's own data, never a join into other schemas
- **ReadinessSnapshot** — userId, targetRoleLevel, requirementSetVersion, percentReady, satisfied[], missing[], computedAt ⚡ ReadinessRecalculated, PromotionEligible (threshold crossed, e.g. 100%)
- Example (matches spec): QA Junior → QA Mid, readiness 82%, missing: Automation Fundamentals (course), Assessment A, Certification B.

## 7.8 Gamification
- **PointLedger** — append-only entries: *PointAward* (sourceEventId, ruleId, points, occurredAt) — idempotent on sourceEventId. Rules data-driven: CourseCompleted +100, AssessmentPassed +50, CertificationEarned +300, ManagerRecognition +200 (admin-configurable)
- **Achievement** / **AchievementGrant** ⚡ AchievementUnlocked
- **LeaderboardProjection** — *Period* (weekly|monthly|quarterly|annual), scope (global|team), ranked entries; materialized by worker, not computed at read time

## 7.9 Analytics (read models only — no aggregates)
Projections: CompletionRateByTeam, LearningVelocity (completions/learner/week), ActiveLearners, TeamProgress, ReadinessDistribution, SkillCoverage, ProgramEffectiveness (pass-rate × completion-rate per program). Rebuildable from the event log.

## 7.10 Notification
- **NotificationTemplate**, **Preference** (per user/channel), **DispatchRecord** (event, channel, status) — channels: Email, In-App (MVP); Teams, Slack (adapter slots reserved)

---

# 8. Database Conceptual Design

(Conceptual only — no SQL. Prisma schema files per context map 1:1 to Postgres schemas.)

**Schemas:** `identity`, `org`, `learning`, `assessment`, `evidence`, `certification`, `promotion`, `gamification`, `analytics`, `notification`, plus shared `infra` (outbox, audit).

**Cross-cutting tables:**
- `infra.domain_events` (outbox/audit): id, contextName, eventType, aggregateId, payload (jsonb), occurredAt, dispatchedAt, dispatchAttempts — append-only; the audit trail and the Service Bus migration seam.
- `infra.audit_log` view over domain_events filtered to security-relevant types.

**Relationship principles:**
- FKs **within** a schema only. Cross-context references are bare UUIDs validated at the application layer (e.g., `promotion.completion_ledger.user_id` is not an FK into `identity.users`).
- Soft deletes only where audit demands (users, evidence); hard delete forbidden on ledgers/snapshots/events.
- All money-equivalent data (scores, points, readiness, approvals) is **append-only or versioned** — corrections are compensating entries, never updates. This is what makes promotion decisions defensible.
- jsonb for polymorphic requirement/question payloads with a `type` discriminator; indexed expressions where queried.
- Every table: `created_at`, `updated_at`, `created_by` where user-initiated.

**Domain events catalog (the contract spine):** UserRegistered, RoleAssigned, EmployeeAssignedToManager, JobLevelChanged, EnrollmentCreated, LessonCompleted, CourseCompleted, PathCompleted, AttemptSubmitted, AssessmentPassed, AssessmentFailed, EvidenceSubmitted, EvidenceApproved, EvidenceRejected, CertificationEarned, CertificationExpired, ReadinessRecalculated, PromotionEligible, PointsAwarded, AchievementUnlocked, ManagerRecognitionGiven, NotificationSent. Each has a versioned schema in `packages/contracts/events`.

---

# 9. Repository Structure

**Monorepo (pnpm workspaces + Turborepo).** One repo = one Claude Code working context = atomic cross-cutting changes = single CI story.

```
lms-platform/
├── CLAUDE.md                  # global Claude Code context (see §10)
├── apps/
│   ├── web/                   # Next.js 15 (App Router)
│   │   ├── app/(auth)/        # sign-in/up (Clerk components)
│   │   ├── app/(employee)/    # my-learning, paths, assessments, evidence, achievements
│   │   ├── app/(manager)/     # team, reviews, approvals, analytics
│   │   ├── app/(admin)/       # catalog builder, requirement sets, gamification config
│   │   ├── components/        # shadcn/ui-based design system usage
│   │   └── CLAUDE.md          # frontend conventions
│   └── api/                   # NestJS modular monolith
│       ├── src/modules/
│       │   ├── identity/
│       │   ├── organization/
│       │   ├── learning/
│       │   │   ├── features/        # VERTICAL SLICES: enroll-user/, complete-lesson/, ...
│       │   │   ├── domain/          # aggregates, VOs, domain services
│       │   │   ├── infrastructure/  # prisma repos, adapters
│       │   │   └── module.md        # context contract: events in/out, public queries
│       │   ├── assessment/  evidence/  certification/
│       │   ├── promotion/   gamification/  analytics/  notification/
│       │   └── shared-kernel/       # base classes, outbox, event bus, Result type
│       ├── src/ports/               # FileStoragePort, EmailPort, EventBusPort, AuthZ...
│       ├── src/adapters/            # cloudinary/, resend/, in-process-bus/, (azure later)
│       └── CLAUDE.md                # backend conventions
├── packages/
│   ├── contracts/             # event schemas, API DTOs, generated OpenAPI client
│   ├── config/                # eslint, tsconfig, tailwind presets
│   └── ui/                    # (optional) shared design-system primitives
├── docs/
│   ├── ARCHITECTURE.md  DECISIONS.md  MEMORY.md  TASKS.md  ROADMAP.md
│   └── modules/<context>.md   # one page per bounded context
├── skills/                    # Claude Code skills library (§12)
├── scripts/                   # db:seed, db:branch, codegen, smoke-test
└── .github/workflows/         # ci.yml, deploy-mvp.yml, deploy-azure.yml (later)
```

**Why this shape:**
- `modules/<context>/features/<slice>` means a Claude Code task touches **one slice folder + its module's domain folder** — typically <1k lines of relevant context.
- `ports/` + `adapters/` make the Azure migration a directory diff.
- `packages/contracts` is the only thing web and api both import — the boundary is explicit and type-checked.
- `module.md` per context is the cheap, always-current context primer Claude reads instead of the code.
- ESLint boundary rules (eslint-plugin-boundaries) **fail CI** on cross-module imports outside `contracts`/`shared-kernel` — discipline is automated, not aspirational.

---

# 10. Claude Code Strategy & Documentation Files

## 10.1 Operating model

1. **One session = one vertical slice** (or one well-scoped task from TASKS.md). Never "build the assessment module" — instead "implement `submit-attempt` slice per module.md contract."
2. **Plan-first protocol:** Claude Code is asked to produce/confirm a short plan against `docs/modules/<context>.md` before writing code; plans are cheap, rewrites are not.
3. **Self-verifying loop:** every slice lands with unit tests + the module's contract tests; Claude Code runs `pnpm test --filter <module>` before declaring done. CI re-verifies.
4. **Docs are updated in the same PR** (DECISIONS.md for new ADRs, MEMORY.md for learned constraints, TASKS.md checkbox).
5. **Subagents/parallelism:** independent slices in different modules can run as parallel Claude Code tasks safely *because* boundaries are enforced — no merge collisions in domain code.

## 10.2 Documentation file specs

**`CLAUDE.md` (root — the contract Claude Code always loads; keep <150 lines):**
- What the product is (3 lines), the module list with one-line purposes
- Hard rules: no cross-module imports; events via outbox; ports for all I/O; append-only ledgers; test command per workspace
- Pointers: "before backend work read `apps/api/CLAUDE.md` + the relevant `docs/modules/*.md`; before frontend work read `apps/web/CLAUDE.md`"
- Commands: dev, test, lint, db:migrate, db:seed
- Explicit anti-goals (no GraphQL, no microservices, no event sourcing, don't add libraries without DECISIONS.md entry)

**`apps/*/CLAUDE.md`:** stack conventions (NestJS slice template / Next.js server-component patterns), error-handling (Result type), naming, where tests live. ~80 lines each.

**`docs/ARCHITECTURE.md`:** the §4–§6 content of this plan, kept current — diagrams, context map, port/adapter inventory. Read by humans and by Claude when a task spans modules.

**`docs/DECISIONS.md`:** ADR log (ADR-001…); every "we chose X over Y" lands here in 5–10 lines. Claude Code is instructed to consult it before proposing alternatives — kills re-litigation loops.

**`docs/MEMORY.md`:** persistent operational memory — environment quirks ("Neon branch URLs expire", "Clerk webhook needs svix verification"), gotchas discovered, perf notes. Claude Code appends; humans prune monthly. This file is what stops Claude from re-discovering the same pitfall in session 30.

**`docs/TASKS.md`:** the backlog as checkbox items grouped by phase, each task phrased as a slice with acceptance criteria ("- [ ] promotion/recalculate-readiness: consumes CourseCompleted…, snapshot has missing[] populated, unit + contract tests"). The unit of assignment to Claude Code sessions.

**`docs/ROADMAP.md`:** phase map (§14), what is explicitly deferred (Teams/Slack, SCIM, multi-tenant), Azure migration triggers/checklist.

**`docs/modules/<context>.md` (one page each):** purpose, aggregates, public queries, events published/consumed (with payload links into contracts), invariants. **This is the highest-leverage file in the repo** — it replaces reading the module's code for 90% of tasks.

---

# 11. Token Optimization Strategy (target: −60% or better)

| Technique | Mechanism | Est. saving |
|---|---|---|
| **Domain isolation** | Module boundaries + `module.md` mean a session loads one context primer (~300 tokens) instead of exploring the codebase (10–50k tokens of file reads) | 30–40% |
| **Vertical-slice tasking** | A slice folder is the complete relevant code surface; Claude never opens unrelated features | 10–15% |
| **Documentation reuse** | CLAUDE.md hierarchy + DECISIONS.md answer "how do we do X here?" in-context — eliminates exploratory reads and re-debating settled choices | 5–10% |
| **Contracts package** | Types/event schemas in one small package; Claude reads the contract, not both implementations | 5% |
| **Context compression rituals** | `/compact` at phase boundaries; start fresh sessions per task (TASKS.md makes resumption cheap); MEMORY.md externalizes long-term state so context never carries it | 5–10% |
| **Task batching** | Group same-module micro-tasks (e.g., 4 CRUD endpoints for catalog admin) into one session — module context is paid for once | 5% |
| **Scaffold generators** | `scripts/new-slice.ts` emits the slice skeleton (handler/dto/test stubs); Claude fills logic instead of generating boilerplate | 5% |
| **Plan-before-code** | A 200-token plan rejected early saves a 5k-token wrong implementation | (avoids spikes) |

Combined realistic effect: **60–75% reduction** vs. an unstructured single-app repo where each session re-explores the codebase. The structural choices (modules, slices, docs) do most of the work — token optimization is an architecture outcome, not a prompting trick.

---

# 12. Claude Code Skills Library (`skills/`)

Each skill = a short md file (50–150 lines) of project-specific conventions + checklists, loaded on demand.

| Skill | Purpose / contents |
|---|---|
| `backend-architecture.md` | NestJS slice anatomy, module registration, outbox usage, Result/error conventions, when full Clean layering applies vs. lightweight CRUD |
| `frontend-architecture.md` | App Router patterns: server components for reads, server actions vs. API calls, Clerk integration, route-group layout (employee/manager/admin), loading/error states, the EPAM-style UX patterns (sidebar nav, My Learning tabs, courseware tree) |
| `database-design.md` | Prisma multi-schema setup, migration workflow on Neon branches, append-only ledger pattern, jsonb discriminator pattern, no-cross-schema-FK rule |
| `testing.md` | Test pyramid per slice, factories/builders, contract-test pattern for events, Playwright POM conventions (defer to repo playwright skill), coverage gates |
| `security.md` | AuthZ guard usage, permission catalog, input validation (zod/class-validator), file-upload safety checklist, audit-event checklist per feature |
| `ddd.md` | This repo's aggregate rules, invariant placement, when to publish an event, ubiquitous-language glossary (Path vs Program vs Course…) |
| `azure.md` | (Phase 9) ACA/Bicep conventions, managed identity, Key Vault references, Service Bus adapter spec, migration runbook |
| `assessment-engine.md` | Question-type polymorphism, scoring rules, attempt state machine, manual-review queue logic |
| `promotion-engine.md` | RequirementSet versioning rules, ledger ingestion idempotency, readiness math (weights), snapshot semantics, eligibility thresholds |
| `gamification.md` | Point-rule configuration, idempotent awarding, leaderboard materialization job, anti-gaming notes (points ≠ readiness) |
| `analytics.md` | Projection-builder pattern, rebuild-from-events procedure, metric definitions (so numbers are consistent everywhere) |
| `notifications.md` | Template system, preference resolution, channel adapters, event→notification mapping table, digest batching |

---

# 13. MCP Recommendations (for Claude Code)

## Essential

| MCP | Purpose | Benefit / usage example | Priority |
|---|---|---|---|
| **Filesystem** (built-in capability) | Read/write repo files | All implementation work | P0 |
| **GitHub** | PRs, issues, reviews, CI status | "Open a PR for the submit-attempt slice; include test results"; triage failing checks without leaving the session | P0 |
| **PostgreSQL** | Inspect schema/data on the Neon **dev branch** (read-only role) | "Why is readiness 0 for user X?" → query ledger + snapshots directly; verify migrations | P0 |
| **Playwright** | Drive a browser for E2E verification | After building the evidence-approval flow, Claude runs the E2E spec and screenshots the manager queue; reproduces UI bugs | P1 |
| **Sequential Thinking** | Structured multi-step reasoning for complex design tasks | Designing the readiness algorithm or the attempt state machine before coding | P1 |
| **Memory** | Persistent knowledge graph across sessions | Complements MEMORY.md for relationships ("EvidenceApproved feeds both Promotion and Gamification") | P1 |

## Recommended

| MCP | Purpose | Benefit | Priority |
|---|---|---|---|
| **Azure DevOps** | Boards/pipelines if org mandates ADO | Sync TASKS.md ↔ work items in Phase 9 | P2 (Phase 9) |
| **Documentation search** (e.g., Context7-style docs MCP) | Current library docs (Next 15, NestJS, Prisma, Clerk) | Prevents stale-API hallucinations; "check current Clerk org-role API" | P2 |
| **Browser automation** (beyond Playwright tests) | Exploratory verification of third-party dashboards (Clerk, Cloudinary config) | Setup/debug assistance | P3 |

**Guardrails:** DB MCP gets read-only credentials and never points at prod; GitHub MCP scoped to the repo; document MCP configuration in MEMORY.md.

---

# 14. Development Phases

Each phase ends with: demoable increment, tests green, docs updated. Tasks are pre-decomposed into slices in TASKS.md.

| Phase | Scope (slices) | Exit criteria | Est. |
|---|---|---|---|
| **0 — Foundation** | Monorepo scaffold, CI, Neon + Railway + Vercel wired, shared-kernel (outbox, event bus, Result), ports defined, seed script, CLAUDE.md suite, skills library | Hello-world deploy on all three; outbox round-trip test green | 1 wk |
| **1 — Identity, AuthZ, Org** | Clerk integration + webhook sync; RBAC guard + permission catalog; employee profiles; role/level taxonomy; manager assignment; admin user mgmt | 3 personas log in and see role-scoped shells; manager sees team | 1.5 wk |
| **2 — Learning Catalog & My Learning** | Admin: paths/programs/courses/modules/lessons builder (draft→publish); assignment (manual + by role-level); employee: My Learning (assigned/in-progress/completed tabs), courseware tree, lesson completion, progress %, learning history | The screenshot UX is reproducible end-to-end with seed content | 2 wk |
| **3 — Assessments** | Authoring (3 question types), delivery + attempts + limits, auto-scoring (MC), manual review queue (open/practical), feedback, pass/fail events | QA path with mixed assessment passes/fails correctly; review queue works | 1.5 wk |
| **4 — Evidence** | Upload (signed URLs, type/size validation), manager review queue, approve/reject + feedback, resubmission, full audit history | Evidence lifecycle E2E incl. rejection→resubmit | 1 wk |
| **5 — Certifications + Analytics v1** | Cert issuance from assessment/course/evidence/manual, expiry job, registry UI; projections: completion rate, velocity, active learners, team progress | Manager dashboard with live team metrics | 1.5 wk |
| **6 — Gamification** | Point rules config, idempotent ledger, achievements, leaderboard materialization (weekly/monthly/quarterly/annual; global/team), recognition (+200) | Leaderboards correct under replay; points visibly ≠ readiness | 1 wk |
| **7 — Promotion Engine** | RequirementSet builder (versioned), completion-ledger ingestion, readiness calc + snapshots, gap report UI ("82%, missing: …"), PromotionEligible event, manager readiness view | Demo scenario: QA Junior→Mid at 82% with named gaps; eligibility notification fires | 1.5 wk |
| **8 — Notifications** | Template system, preferences, in-app center, email via Resend; events: new assignment, due soon, evidence decided, promotion eligible; digest batching | All five event types deliver on both channels | 1 wk |
| **9 — Enterprise readiness & Azure migration** | Hardening (rate limits, audit review, pen-test fixes), OTel exporter → App Insights, Azure adapters (Blob, Service Bus, Entra), Bicep IaC, data migration runbook + rehearsal, cutover | Platform runs on Azure; MVP stack decommissioned | 3–4 wk |

**MVP demo ready after Phase 7 (~10–11 weeks); full MVP Phase 8 (~12 weeks).** Phases 3↔4 and 5↔6 are parallelizable across Claude Code sessions (disjoint modules).

---

# 15. Testing Strategy

| Layer | Scope | Tooling | Target |
|---|---|---|---|
| **Unit** | Domain logic: readiness math, scoring, attempt/evidence state machines, point rules, requirement evaluation | Vitest (api + packages), factories/builders per aggregate | **90%+ on `domain/`** in Promotion, Assessment, Evidence, Gamification; 70% elsewhere |
| **Integration** | Slice handlers against real Postgres (Testcontainers locally / Neon branch in CI), outbox dispatch, Prisma repos, webhook handlers | Vitest + Testcontainers; mocked ports (email, storage) | Every slice has ≥1 happy + 1 failure integration test |
| **Contract** | Event payloads vs. `packages/contracts` schemas (publisher and consumer both validate); OpenAPI client vs. API | zod schema tests + generated-client typecheck in CI | 100% of published events and public queries |
| **End-to-End** | The 8 golden journeys: login×3 personas; assign path→complete course; take assessment (pass/fail/review); evidence submit→reject→resubmit→approve; readiness gap view; leaderboard; notification receipt; admin builds a requirement set | Playwright with POM (per repo `playwright-pom` skill: role-based locators, fixtures, no sleeps, parallel-safe) | Golden journeys green on every PR preview; <10 min wall time |
| **Performance** | Readiness recalculation fan-out (1 course completion → N user snapshots), leaderboard materialization, list endpoints | k6 smoke in CI (Phase 5+), full load test in Phase 9 against Azure staging | p95 API <300ms @ 100 concurrent; recalc job <5s per 1k users |

**Policy:** tests are written in the same Claude Code session as the slice (self-verifying loop, §10.1); CI blocks merge on unit+integration+contract; E2E runs on preview deployments (Vercel preview + Neon branch per PR — the branching choice pays off here).

---

# 16. Security Strategy

- **RBAC:** central permission catalog (`permission.ts` in shared-kernel) → NestJS guard + frontend route guards. Three platform roles now; permission-based (not role-based) checks in code so custom roles later are config-only. Manager scope checks (can only act on *assigned* employees) enforced in handlers, tested explicitly.
- **Audit logs:** `infra.domain_events` is the substrate; security-relevant subset (role changes, requirement-set edits, evidence decisions, score finalizations, admin config changes) surfaced in an admin Audit view. Append-only; retention ≥ 7 years for promotion-relevant records (HR defensibility).
- **Encryption:** TLS everywhere; at-rest encryption native on Neon/Azure PG and Cloudinary/Blob; no PII in logs (logger redaction list); secrets only in Railway/Vercel env vaults (MVP) → Key Vault + managed identity (Azure). No secrets in repo — gitleaks in CI.
- **Secure uploads:** client → signed upload URL (Cloudinary/Blob SAS) so files never transit our API; server-side validation of declared type/size; allow-list (pdf, docx, png, jpg); checksum stored; downloads via short-lived signed URLs scoped by AuthZ (an employee's evidence is visible to self, their manager, admins only). Azure stage: Defender for Storage malware scanning; quarantine container until scan passes.
- **OWASP Top 10:** parameterized access via Prisma (injection); Clerk/Entra + short-lived JWTs (auth failures); object-level authorization checks in every handler — IDs are never trusted (BOLA, the #1 real risk here); rate limiting (Nest throttler → Front Door WAF); dependency scanning (Renovate + `pnpm audit` + GitHub Dependabot); security headers + strict CSP on web; SSRF-safe fetch wrapper for any URL ingestion.
- **GDPR readiness:** lawful basis = legitimate interest/employment contract (document it); data inventory per schema in docs; DSR support — export (per-user data bundle job) and erasure (anonymize identity row; ledgers keep pseudonymous IDs for audit integrity — documented retention policy); EU region selectable on Neon/Azure; DPAs available from all chosen vendors (Clerk, Cloudinary, Resend, Sentry).
- **Multi-tenant design:** MVP is single-tenant. Future-proofing only: `tenant_id` column on root tables from day one (defaulted, indexed, ignored by logic) + tenant claim slot in the JWT contract. Full row-level-security multi-tenancy is explicitly deferred (ROADMAP.md) — premature RLS would tax every query for no current customer.

---

# 17. Observability Strategy

**Instrument once with OpenTelemetry; swap exporters per stage.** Structured JSON logs (pino) with correlationId propagated from frontend request → API → BullMQ job → event handlers.

| Concern | MVP | Azure Enterprise |
|---|---|---|
| Errors | Sentry (web + api, source maps, release tracking) | App Insights (Sentry optionally retained) |
| Logs | pino → Railway logs (+ Better Stack free tier if retention needed) | Log Analytics workspace, KQL queries |
| Metrics | OTel metrics → Sentry performance; BullMQ dashboard (bull-board, admin-only) | Azure Monitor metrics + workbooks; KEDA autoscale on same metrics |
| Tracing | OTel traces → Sentry (web→api→db spans) | App Insights distributed tracing incl. Service Bus hops |
| Uptime | Better Stack heartbeat on /health + queue-depth healthcheck | Front Door health probes + availability tests |
| Alerting | Sentry alerts → email/Slack: error-rate spike, p95 breach, outbox dispatch lag > 1 min, DLQ-equivalent (failed BullMQ jobs) | Azure Monitor alerts + action groups; same SLOs |
| Dashboards | Sentry + bull-board | Workbooks: API SLOs, queue depth, recalc latency, DB health, **business ops**: events/day, readiness recalcs, evidence review SLA |

**Domain-level observability (often forgotten):** track *business* health — evidence items awaiting review > 7 days, assessments awaiting manual review, outbox lag, notification failure rate. These are product-failure modes, alert on them like infra.

---

# 18. Cost Evolution

## MVP (demo, ≤ ~200 users)
| Service | Plan | $/mo |
|---|---|---|
| Vercel | Hobby (Pro $20 if team features needed) | 0–20 |
| Railway | API + worker + Redis (usage-based) | 10–20 |
| Neon | Free (0.5GB, branching incl.) → Launch $19 if needed | 0–19 |
| Clerk | Free to 10k MAU | 0 |
| Cloudinary | Free 25 credits | 0 |
| Resend | Free 3k emails/mo | 0 |
| Sentry | Developer free | 0 |
| **Total** | | **$10–45/mo** |

## Growth (~500–2,000 users, pre-Azure)
Vercel Pro $20 · Railway scaled $50–100 · Neon Launch/Scale $19–69 · Clerk Pro ~$25+MAU · Cloudinary Plus ~$89 (evidence volume) · Resend $20 · Sentry Team $26 → **~$250–450/mo.** Trigger to consider migration: cost crossing ~$500/mo, SSO mandate, or compliance requirements — usually the **Entra SSO mandate arrives first**.

## Azure Enterprise (2,000–10,000 employees, prod + staging)
| Component | Est. $/mo |
|---|---|
| Container Apps (api + worker, ~2–4 vCPU sustained) | 150–400 |
| PostgreSQL Flexible Server (2–4 vCore, zone-redundant HA + PITR) | 250–600 |
| Blob Storage + Defender | 20–80 |
| Service Bus Standard | 10–50 |
| Azure Cache for Redis (Basic/Std C1) | 20–75 |
| Front Door + WAF | 50–120 |
| App Insights / Log Analytics (sampled) | 50–200 |
| Key Vault, ACR, Entra (existing tenant), misc | 20–60 |
| Staging env (scaled down) | 100–200 |
| **Total** | **~$700–1,800/mo** |

At 5,000 employees that is **≈ $0.15–0.35/employee/month** — negligible against the HR value of evidence-based promotion data.

---

# 19. Risk Analysis

| # | Risk | L | I | Mitigation |
|---|---|---|---|---|
| 1 | **Promotion-rule complexity creep** (per-team exceptions, weighting debates) | H | H | ADR-006: rules are versioned data; engine stays generic; exceptions = new RequirementSet versions, never code branches; admin UI constrains expressible rules |
| 2 | **Manager review bottleneck** (evidence/assessments pile up → data goes stale → trust collapses) | H | H | Review-SLA metrics + alerts (§17); digest notifications; bulk-review UX; readiness UI shows "pending review" distinctly from "missing" |
| 3 | **Gamification gaming** (point farming; leaderboard ≠ merit) | M | M | Points firewall-separated from readiness (§2.2); idempotent ledger; per-source daily caps configurable; recognition requires manager action |
| 4 | **Module-boundary erosion** (monolith → mud) | M | H | ESLint boundary rules fail CI; module.md contracts; PR review checklist; Claude Code hard rules in CLAUDE.md |
| 5 | Vendor lock-in (Clerk/Cloudinary) | M | M | Ports & adapters (ADR family); user table is ours (Clerk holds only credentials); files referenced by storage-agnostic keys |
| 6 | Claude Code context drift / inconsistent patterns | M | M | Skills library + scaffold generator + plan-first protocol; MEMORY.md; periodic consistency-audit sessions |
| 7 | Data-integrity bugs in readiness (wrong promotion data = HR liability) | L | **VH** | Append-only ledgers, snapshot versioning, 90% domain coverage gate, replay-based verification, audit trail |
| 8 | GDPR/works-council objections to leaderboards & tracking | M | M | Preference-based leaderboard opt-out flag (cheap now); documented lawful basis; anonymized analytics aggregates |
| 9 | Azure migration slippage | M | M | Migration is rehearsed (staging dry-run with prod-shaped data) and reversible (DNS-level cutover, Neon kept warm 30 days) |
| 10 | Scope creep pre-MVP (Teams/Slack, SCIM, multi-tenant) | H | M | ROADMAP.md "explicitly deferred" list; adapter slots reserved so deferral is credible |

---

# 20. Migration Strategy (MVP → Azure)

**Principle: re-platform, not re-architecture.** The monolith image, schema, and domain code move unchanged; only adapters and config change.

**Pre-work (done during MVP, costs ~0):** Dockerfile is the deploy artifact from day one (Railway runs it); OTel instrumentation in place; ports for storage/email/events/auth; `tenant_id`/audit columns present; IaC-friendly config (12-factor env).

**Sequence (Phase 9, ~3–4 weeks):**
1. **Land the zone:** Bicep/Terraform — VNet, ACA environment, PG Flexible Server, Blob, Service Bus, Key Vault, ACR, Front Door, App Insights, private endpoints. GitHub Actions OIDC → Azure.
2. **Adapter build-out:** `adapters/azure-blob`, `adapters/service-bus` (outbox dispatcher publishes to topics; consumers become Service Bus subscriptions with DLQ), `adapters/acs-email` (or SendGrid-on-Azure). Feature-flag selectable.
3. **Identity cutover (the only user-visible change):** Entra ID app registration; OIDC in API replaces Clerk JWT verification behind the same auth port; user matching by corporate email → `externalAuthId` re-mapped; staged rollout (admins → pilot team → all). Clerk retired after 2 clean weeks.
4. **Data migration:** files — batch copy Cloudinary→Blob (keys preserved by the port's key scheme); DB — rehearse with pg_dump/restore to staging; production cutover via short write-freeze (<30 min, off-hours) dump/restore, or logical replication if zero-downtime is mandated.
5. **Cutover & rollback:** deploy to ACA staging → golden-journey E2E + k6 against staging → DNS/Front Door switch → monitor 48h with App Insights + retained Sentry → Neon/Railway kept warm 30 days as rollback path.
6. **Decommission + hardening:** WAF rules, Defender, Azure Policy, cost alerts; update ARCHITECTURE.md/DECISIONS.md.

**Post-migration evolution (optional, demand-driven):** extract Notification or Analytics into their own ACA apps first if scaling demands — they are pure event consumers, so extraction = move module + point its Service Bus subscription at the new app. The architecture has been paying for this option since Phase 0.

---

# 21. Final Recommended Implementation Order

1. **Week 0 — Decide & freeze:** ratify ADR-001…006; create repo from this plan; write CLAUDE.md suite, module.md stubs, TASKS.md for Phases 0–2; configure MCPs (GitHub, Postgres-readonly, Playwright).
2. **Phase 0 (wk 1):** scaffold + pipelines + outbox/event-bus kernel + ports. *Nothing domain-specific until the kernel round-trip test passes.*
3. **Phase 1 (wk 2–3):** Identity → Organization. Every later module depends on user/role/manager primitives.
4. **Phase 2 (wk 3–5):** Learning catalog + My Learning. First demoable value; reproduces the reference UX.
5. **Phases 3 & 4 in parallel sessions (wk 5–7):** Assessment ∥ Evidence — disjoint modules, both feed Promotion.
6. **Phase 5 (wk 7–8):** Certification + Analytics v1 (projection infrastructure matures here).
7. **Phase 6 (wk 8–9):** Gamification (depends only on the event stream).
8. **Phase 7 (wk 9–11):** **Promotion engine last among domains** — deliberately: by now every upstream event it consumes exists and is battle-tested, so the core domain is built on stable contracts. Demo milestone: the "QA Junior → 82% → missing list" scenario.
9. **Phase 8 (wk 11–12):** Notifications wired to all five event types. **MVP complete — run the stakeholder demo.**
10. **Stabilize (wk 12–14):** golden-journey hardening, seed realistic content, pilot with one team, collect manager-workflow feedback (risk #2).
11. **Phase 9 (month 4–6, triggered by SSO/compliance/cost):** Azure landing zone → adapters → Entra cutover → data migration → decommission.
12. **Beyond:** Teams/Slack notification adapters, SCIM provisioning, advanced analytics, selective service extraction — all pre-slotted, none blocking.

---

*End of master plan. Companion artifacts to generate next (each a separate Claude Code session): `CLAUDE.md` v1, `docs/modules/*.md` stubs, `TASKS.md` for Phases 0–2, and the Phase 0 scaffold.*
