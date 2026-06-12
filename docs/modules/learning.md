# Learning

**Purpose:** catalog (study paths → programs → courses → modules → lessons), enrollment, progress.

## Aggregates
- **Course** — modules[] → lessons[] (`video|reading|exercise`, durationMin);
  completionRule `all-lessons | quiz-pass`; status `draft|published|archived`; version.
- **Program** — ordered courseIds with schedule windows. **StudyPath** — targets RoleLevel,
  ordered items (course|program|assessment ref), status, version.
- **Enrollment** — userId, target (kind+id), source `assigned|self`, assignedBy?, dueDate?,
  status `active|completed|withdrawn`.
- **ProgressRecord** — per enrollment: lessonCompletions[] (idempotent set), percentComplete,
  completedAt?.

## Public queries
`LearningQueries.getCourse(id)`, `.listPublishedCatalog()`, `.getMyLearning(userId)`
(todo/active/completed buckets), `.getProgress(enrollmentId)`.

## Events published
`EnrollmentCreated { enrollmentId, userId, targetKind, targetId, source }`,
`LessonCompleted { userId, enrollmentId, courseId, lessonId }`,
`CourseCompleted { userId, enrollmentId, courseId }` (exactly once),
`PathCompleted { userId, pathId }`.

## Events consumed
- `RoleAssigned` / role-level assignment → auto-enroll into paths targeting that RoleLevel.

## Invariants
- Progress only on **active** enrollment. Lesson completion is idempotent.
- `CourseCompleted` fires exactly once per (enrollmentId, courseId).
- Only `published` items can be enrolled in; published content edits bump version.

## Permissions
`catalog.read` (all), `catalog.manage` (admin), `enrollment.assign` (manager/admin for own scope).
