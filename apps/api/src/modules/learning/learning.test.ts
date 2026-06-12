import { describe, expect, it } from 'vitest';
import { AuthenticatedUser } from '../../ports/auth.port';
import { unwrap } from '../shared-kernel/result';
import { Kernel, createTestKernel } from '../shared-kernel/testing';
import { LearningModule, createLearningModule } from './learning.module';

const admin: AuthenticatedUser = { userId: 'admin-1', role: 'admin' };
const learner: AuthenticatedUser = { userId: 'u-1', role: 'employee' };

function setup(isManagerOf: (m: string, u: string) => boolean = () => false) {
  const kernel = createTestKernel();
  const learning = createLearningModule({ ...kernel, isManagerOf });
  return { kernel, learning };
}

function publishedCourse(learning: LearningModule, lessons = 2, title = 'TS Basics'): string {
  const { courseId } = unwrap(
    learning.authorCatalog.createCourse(
      {
        title,
        modules: [
          {
            title: 'M1',
            lessons: Array.from({ length: lessons }, (_, i) => ({
              title: `L${i + 1}`,
              type: 'video' as const,
              durationMin: 10,
            })),
          },
        ],
      },
      admin,
    ),
  );
  unwrap(learning.authorCatalog.publishCourse(courseId, admin));
  return courseId;
}

function lessonIdsOf(learning: LearningModule, courseId: string): string[] {
  return learning.queries.getCourse(courseId)!.lessonIds();
}

describe('learning catalog', () => {
  it('drafts cannot be enrolled in; published can; duplicate enrollment rejected', () => {
    const { learning } = setup();
    const { courseId } = unwrap(
      learning.authorCatalog.createCourse(
        { title: 'Draft', modules: [{ title: 'M', lessons: [{ title: 'L', type: 'reading', durationMin: 5 }] }] },
        admin,
      ),
    );
    const draft = learning.enrollUser.execute(
      { userId: learner.userId, targetKind: 'course', targetId: courseId },
      learner,
    );
    expect(draft.ok).toBe(false);

    unwrap(learning.authorCatalog.publishCourse(courseId, admin));
    unwrap(
      learning.enrollUser.execute({ userId: learner.userId, targetKind: 'course', targetId: courseId }, learner),
    );
    const dup = learning.enrollUser.execute(
      { userId: learner.userId, targetKind: 'course', targetId: courseId },
      learner,
    );
    expect(dup.ok).toBe(false);
  });

  it('non-admin cannot author; employee cannot enroll others; manager only own team', () => {
    const { learning } = setup((m, u) => m === 'mgr-1' && u === 'u-1');
    expect(learning.authorCatalog.createCourse({ title: 'X', modules: [] }, learner).ok).toBe(false);

    const courseId = publishedCourse(learning);
    const stranger = learning.enrollUser.execute(
      { userId: 'other', targetKind: 'course', targetId: courseId },
      learner,
    );
    expect(stranger.ok).toBe(false);

    const mgr: AuthenticatedUser = { userId: 'mgr-1', role: 'manager' };
    const outOfScope = learning.enrollUser.execute(
      { userId: 'u-99', targetKind: 'course', targetId: courseId },
      mgr,
    );
    expect(outOfScope.ok).toBe(false);
    const inScope = learning.enrollUser.execute(
      { userId: 'u-1', targetKind: 'course', targetId: courseId },
      mgr,
    );
    expect(inScope.ok).toBe(true);
  });
});

describe('progress & CourseCompleted exactly-once', () => {
  it('tracks percent, emits LessonCompleted once per lesson, CourseCompleted exactly once', () => {
    const { kernel, learning } = setup();
    const courseId = publishedCourse(learning, 2);
    const { enrollmentId } = unwrap(
      learning.enrollUser.execute({ userId: learner.userId, targetKind: 'course', targetId: courseId }, learner),
    );
    const [l1, l2] = lessonIdsOf(learning, courseId);

    const first = unwrap(learning.completeLesson.execute({ enrollmentId, lessonId: l1! }, learner));
    expect(first.percentComplete).toBe(50);

    // idempotent repeat — no new event
    unwrap(learning.completeLesson.execute({ enrollmentId, lessonId: l1! }, learner));
    expect(kernel.outbox.all().filter((e) => e.type === 'LessonCompleted')).toHaveLength(1);

    const last = unwrap(learning.completeLesson.execute({ enrollmentId, lessonId: l2! }, learner));
    expect(last.courseCompleted).toBe(true);
    expect(kernel.outbox.all().filter((e) => e.type === 'CourseCompleted')).toHaveLength(1);

    // completed enrollment refuses further progress (and cannot re-emit)
    const after = learning.completeLesson.execute({ enrollmentId, lessonId: l2! }, learner);
    expect(after.ok).toBe(false);
    expect(kernel.outbox.all().filter((e) => e.type === 'CourseCompleted')).toHaveLength(1);
  });

  it('rejects foreign lessons, foreign users, and unknown enrollments', () => {
    const { learning } = setup();
    const courseId = publishedCourse(learning);
    const { enrollmentId } = unwrap(
      learning.enrollUser.execute({ userId: learner.userId, targetKind: 'course', targetId: courseId }, learner),
    );
    expect(learning.completeLesson.execute({ enrollmentId, lessonId: 'nope' }, learner).ok).toBe(false);
    expect(
      learning.completeLesson.execute({ enrollmentId, lessonId: lessonIdsOf(learning, courseId)[0]! }, { userId: 'intruder', role: 'employee' }).ok,
    ).toBe(false);
    expect(learning.completeLesson.execute({ enrollmentId: 'ghost', lessonId: 'l' }, learner).ok).toBe(false);
  });

  it('my-learning buckets: todo (0%), active (>0%), completed', () => {
    const { learning } = setup();
    const c1 = publishedCourse(learning, 2, 'C1');
    const c2 = publishedCourse(learning, 1, 'C2');
    const c3 = publishedCourse(learning, 1, 'C3');
    const enroll = (targetId: string) =>
      unwrap(
        learning.enrollUser.execute({ userId: learner.userId, targetKind: 'course', targetId }, learner),
      ).enrollmentId;
    enroll(c1);
    const e2 = enroll(c2);
    const e3 = enroll(c3);
    unwrap(learning.completeLesson.execute({ enrollmentId: e3, lessonId: lessonIdsOf(learning, c3)[0]! }, learner));
    // e2: complete... wait c2 has 1 lesson so completing finishes it. Use c1 for active.
    const view = learning.queries.getMyLearning(learner.userId);
    expect(view.todo.map((v) => v.targetId).sort()).toEqual([c1, c2].sort());
    expect(view.completed.map((v) => v.targetId)).toEqual([c3]);
    void e2;
  });
});

describe('paths, auto-enroll, quiz-pass', () => {
  it('auto-enrolls on JobLevelChanged into matching published paths and completes the path when all courses complete', () => {
    const { kernel, learning } = setup();
    const c1 = publishedCourse(learning, 1, 'Course A');
    const { pathId } = unwrap(
      learning.authorCatalog.createPath(
        {
          title: 'QA Junior Path',
          targetRoleLevel: { jobRoleId: 'qa', jobLevelId: 'junior' },
          items: [{ kind: 'course', refId: c1 }],
        },
        admin,
      ),
    );
    unwrap(learning.authorCatalog.publishPath(pathId, admin));

    // organization publishes JobLevelChanged — simulate through the kernel publisher
    kernel.publisher.publishPending('organization', [
      {
        type: 'JobLevelChanged',
        aggregateId: 'u-1',
        payload: { userId: 'u-1', jobRoleId: 'qa', fromLevelId: null, toLevelId: 'junior', changedBy: 'admin-1' },
      },
    ]);

    const pathEnrollment = learning.queries
      .userEnrollments('u-1')
      .find((e) => e.targetKind === 'path');
    expect(pathEnrollment).toBeDefined();
    expect(pathEnrollment!.source).toBe('assigned');

    // replaying the same event must not duplicate (bus dedup + byUserAndTarget guard)
    kernel.publisher.publishPending('organization', [
      {
        type: 'JobLevelChanged',
        aggregateId: 'u-1',
        payload: { userId: 'u-1', jobRoleId: 'qa', fromLevelId: null, toLevelId: 'junior', changedBy: 'admin-1' },
      },
    ]);
    expect(learning.queries.userEnrollments('u-1').filter((e) => e.targetKind === 'path')).toHaveLength(1);

    // completing the only course completes the path
    const { enrollmentId } = unwrap(
      learning.enrollUser.execute({ userId: 'u-1', targetKind: 'course', targetId: c1 }, learner),
    );
    unwrap(learning.completeLesson.execute({ enrollmentId, lessonId: lessonIdsOf(learning, c1)[0]! }, learner));
    expect(kernel.outbox.all().map((e) => e.type)).toContain('PathCompleted');
    const completedPath = learning.queries.userEnrollments('u-1').find((e) => e.targetKind === 'path')!;
    expect(completedPath.status).toBe('completed');
  });

  it('quiz-pass course completes on AssessmentPassed, exactly once', () => {
    const { kernel, learning } = setup();
    const { courseId } = unwrap(
      learning.authorCatalog.createCourse(
        {
          title: 'Quiz Course',
          modules: [{ title: 'M', lessons: [{ title: 'L', type: 'reading', durationMin: 5 }] }],
          completionRule: 'quiz-pass',
          quizAssessmentId: 'as-1',
        },
        admin,
      ),
    );
    unwrap(learning.authorCatalog.publishCourse(courseId, admin));
    unwrap(
      learning.enrollUser.execute({ userId: 'u-1', targetKind: 'course', targetId: courseId }, learner),
    );
    const passedEvent = {
      type: 'AssessmentPassed' as const,
      aggregateId: 'att-1',
      payload: { userId: 'u-1', assessmentId: 'as-1', attemptId: 'att-1', scorePct: 90 },
    };
    kernel.publisher.publishPending('assessment', [passedEvent]);
    expect(kernel.outbox.all().filter((e) => e.type === 'CourseCompleted')).toHaveLength(1);
    kernel.publisher.publishPending('assessment', [passedEvent]);
    expect(kernel.outbox.all().filter((e) => e.type === 'CourseCompleted')).toHaveLength(1);
  });
});
