# Analytics

**Purpose:** read-only projections for dashboards. No aggregates — pure event consumer;
every projection is rebuildable from the event log.

## Projections
- **CompletionRateByTeam** — completions / enrollments per team.
- **LearningVelocity** — course completions per learner per ISO week.
- **ActiveLearners** — distinct users with any learning event per period.
- **TeamProgress** — per manager: member, enrolled, completed, avg progress.
- **ReadinessDistribution** — histogram of latest readiness % per RoleLevel target.

## Public queries
`AnalyticsQueries.completionRateByTeam()`, `.learningVelocity(weeks)`, `.activeLearners(period)`,
`.teamProgress(managerId)`, `.readinessDistribution()`.

## Events consumed
ALL (projection builder subscribes broadly): EnrollmentCreated, LessonCompleted,
CourseCompleted, AssessmentPassed/Failed, EvidenceApproved/Rejected, CertificationEarned,
ReadinessRecalculated, EmployeeAssignedToManager.

## Invariants
- Projections are disposable: `rebuild()` replays the outbox/audit log from zero and must
  produce identical results (tested).
- No writes from queries; no other module reads analytics state.

## Permissions
`analytics.team` (manager own team), `analytics.global` (admin).
