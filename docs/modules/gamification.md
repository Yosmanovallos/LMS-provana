# Gamification

**Purpose:** engagement — point ledger, achievements, leaderboards. Firewall-separated from
Promotion: points never feed readiness.

## Aggregates
- **PointLedger** (append-only) — entries `{ entryId, userId, ruleId, points, sourceEventId,
  occurredAt }`, idempotent on sourceEventId.
- **PointRule** (data-driven, admin-config) — `{ ruleId, eventType, points, dailyCapPerUser? }`.
  Defaults: CourseCompleted +100, AssessmentPassed +50, CertificationEarned +300,
  ManagerRecognitionGiven +200.
- **Achievement** — `{ id, name, criterion (kind+threshold) }`; **AchievementGrant** per user,
  granted once.
- **LeaderboardProjection** — period `weekly|monthly|quarterly|annual`, scope `global|team`,
  ranked `{ userId, points, rank }`; **materialized** by a job from the ledger, never computed
  at read time.

## Public queries
`GamificationQueries.pointsOf(userId)`, `.leaderboard(period, scope, ref)`,
`.achievementsOf(userId)`.

## Events published
`PointsAwarded { userId, ruleId, points, sourceEventId }`,
`AchievementUnlocked { userId, achievementId }`.

## Events consumed
`CourseCompleted`, `AssessmentPassed`, `CertificationEarned`, `ManagerRecognitionGiven`.

## Invariants
- Awarding is idempotent on sourceEventId (replay-safe — tested by replaying the same event).
- Daily caps per rule enforced when configured. Achievements grant at most once.
- Leaderboards rebuildable from ledger; ties share rank (competition ranking).

## Permissions
`gamification.read`, `gamification.recognize` (manager → own team), `gamification.manage` (admin).
