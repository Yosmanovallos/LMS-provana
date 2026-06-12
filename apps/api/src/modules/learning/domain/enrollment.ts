import { EnrollmentTargetKind } from '@lms/contracts';
import { AggregateRoot } from '../../shared-kernel/aggregate-root';
import { Result, err, ok } from '../../shared-kernel/result';

export type EnrollmentStatus = 'active' | 'completed' | 'withdrawn';

/**
 * Enrollment owns its progress record (master plan §7.3). Course enrollments track lesson
 * completions; path/program/assessment enrollments complete via events.
 */
export class Enrollment extends AggregateRoot {
  status: EnrollmentStatus = 'active';
  readonly lessonCompletions = new Set<string>();
  percentComplete = 0;
  completedAt: string | null = null;

  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly targetKind: EnrollmentTargetKind,
    public readonly targetId: string,
    public readonly source: 'assigned' | 'self',
    public readonly assignedBy: string | null = null,
    public readonly dueDate: string | null = null,
  ) {
    super();
  }

  recordCreated(): void {
    this.recordEvent('EnrollmentCreated', this.id, {
      enrollmentId: this.id,
      userId: this.userId,
      targetKind: this.targetKind,
      targetId: this.targetId,
      source: this.source,
      ...(this.assignedBy ? { assignedBy: this.assignedBy } : {}),
      ...(this.dueDate ? { dueDate: this.dueDate } : {}),
    });
  }

  /**
   * Idempotent lesson completion. Emits LessonCompleted on first completion of each lesson
   * and CourseCompleted exactly once when the rule is satisfied.
   */
  completeLesson(
    lessonId: string,
    courseLessonIds: string[],
    completionRule: 'all-lessons' | 'quiz-pass',
    at: Date,
  ): Result<{ courseJustCompleted: boolean }> {
    if (this.targetKind !== 'course') return err('invariant', 'Not a course enrollment');
    if (this.status !== 'active') return err('invariant', 'Progress only on active enrollment');
    if (!courseLessonIds.includes(lessonId)) {
      return err('validation', `Lesson ${lessonId} is not part of course ${this.targetId}`);
    }
    if (this.lessonCompletions.has(lessonId)) {
      return ok({ courseJustCompleted: false }); // idempotent — no duplicate events
    }
    this.lessonCompletions.add(lessonId);
    this.percentComplete = Math.round((this.lessonCompletions.size / courseLessonIds.length) * 100);
    this.recordEvent('LessonCompleted', this.id, {
      userId: this.userId,
      enrollmentId: this.id,
      courseId: this.targetId,
      lessonId,
    });
    const allDone = courseLessonIds.every((l) => this.lessonCompletions.has(l));
    if (completionRule === 'all-lessons' && allDone && !this.completedAt) {
      this.markCourseCompleted(at);
      return ok({ courseJustCompleted: true });
    }
    return ok({ courseJustCompleted: false });
  }

  /** quiz-pass rule: called by the AssessmentPassed subscriber. Exactly-once guarded. */
  completeViaQuiz(at: Date): boolean {
    if (this.targetKind !== 'course' || this.status !== 'active' || this.completedAt) return false;
    this.markCourseCompleted(at);
    return true;
  }

  completeAsPath(at: Date): boolean {
    if (this.targetKind !== 'path' || this.status !== 'active' || this.completedAt) return false;
    this.status = 'completed';
    this.completedAt = at.toISOString();
    this.percentComplete = 100;
    this.recordEvent('PathCompleted', this.id, { userId: this.userId, pathId: this.targetId });
    return true;
  }

  private markCourseCompleted(at: Date): void {
    this.status = 'completed';
    this.completedAt = at.toISOString();
    this.percentComplete = 100;
    this.recordEvent('CourseCompleted', this.id, {
      userId: this.userId,
      enrollmentId: this.id,
      courseId: this.targetId,
    });
  }
}
