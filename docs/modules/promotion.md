# Promotion (CORE DOMAIN)

**Purpose:** versioned requirement sets per RoleLevel transition; completion ledger fed by
events; readiness snapshots and gap reports; eligibility signal.

## Aggregates
- **RequirementSet** — id, fromRoleLevel `{jobRoleId, jobLevelId}`, toRoleLevel, **version**,
  effectiveFrom, status `draft|active|superseded`, requirements[]: discriminated union
  `CourseRequirement {courseId}` | `AssessmentRequirement {assessmentId}` |
  `CertificationRequirement {certificationName}` | `EvidenceRequirement {requirementKey}` |
  `TenureRequirement {months}` — each with `weight` (positive number; readiness % is
  weight-normalized).
- **CompletionLedger** (append-only per user) — facts: `{ factId, userId, kind
  (course-completed|assessment-passed|certification-earned|evidence-approved), refId,
  sourceEventId, occurredAt }`. Idempotent on sourceEventId. Promotion's OWN data — never a
  join into other schemas.
- **ReadinessSnapshot** — userId, targetRoleLevel, requirementSetId, requirementSetVersion,
  percentReady (0–100), satisfied[], missing[] (requirement descriptors), computedAt.
  Append-only.

## Public queries
`PromotionQueries.latestSnapshot(userId)`, `.gapReport(userId)`, `.teamReadiness(managerId)`,
`.listRequirementSets()`.

## Events published
`ReadinessRecalculated { userId, snapshotId, percentReady }`,
`PromotionEligible { userId, targetRoleLevel, requirementSetVersion }` (fired when a snapshot
first reaches 100 for that user+set+version).

## Events consumed (→ ledger ingestion, then recalculation)
`CourseCompleted`, `AssessmentPassed`, `CertificationEarned`, `EvidenceApproved`,
`JobLevelChanged` (re-targets the active requirement set).

## Invariants
- Requirement sets are **versioned data**: editing an active set creates version n+1;
  old snapshots keep referencing the version they were computed with (auditability).
- Ledger is append-only and idempotent on sourceEventId.
- Gamification points NEVER appear here.
- Readiness math: `percentReady = 100 * Σ(weight of satisfied) / Σ(weight of all)`;
  TenureRequirement satisfied by months since profile's current-level start.

## Permissions
`promotion.read-self`, `promotion.read-team` (manager), `requirement-sets.manage` (admin).
