# Assessment

**Purpose:** authoring and delivery of quizzes/open/practical assessments; attempts, scoring,
manual review queue.

## Aggregates
- **Assessment** — title, questions[] (`MultipleChoice {options, correctIndexes, points}` |
  `OpenText {points}` | `PracticalExercise {instructions, points}`), passingScorePct,
  maxAttempts, status `draft|published`.
- **Attempt** — userId, assessmentId, answers[], score?, status
  `in-progress → submitted → auto-scored | awaiting-review → passed | failed`,
  reviewerId?, feedback?.

## Public queries
`AssessmentQueries.getAssessment(id)`, `.listForUser(userId)`, `.reviewQueue(reviewerScope)`.

## Events published
`AttemptSubmitted { attemptId, userId, assessmentId }`,
`AssessmentPassed { userId, assessmentId, attemptId, scorePct }`,
`AssessmentFailed { userId, assessmentId, attemptId, scorePct }`.

## Events consumed
- `EnrollmentCreated` (assessment targets) → visibility in user's todo list.

## Invariants
- attempts ≤ maxAttempts (counting non-in-progress attempts).
- MC questions auto-score; if any open/practical answers exist the attempt goes to
  `awaiting-review` and needs a manager/admin review before final score.
- Score immutable once finalized (passed/failed). Review requires feedback when failing.
- Pass ⇔ scorePct ≥ passingScorePct.

## Permissions
`assessment.take` (employee), `assessment.review` (manager/admin, manager limited to own team),
`assessment.manage` (admin).
