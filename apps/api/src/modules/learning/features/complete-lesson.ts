import { AuthenticatedUser } from '../../../ports/auth.port';
import { ClockPort } from '../../../ports/system.port';
import { DomainEventPublisher } from '../../shared-kernel/publisher';
import { Result, err, ok } from '../../shared-kernel/result';
import { CourseRepository, EnrollmentRepository } from '../learning.repositories';

export class CompleteLessonHandler {
  constructor(
    private readonly enrollments: EnrollmentRepository,
    private readonly courses: CourseRepository,
    private readonly publisher: DomainEventPublisher,
    private readonly clock: ClockPort,
  ) {}

  execute(
    input: { enrollmentId: string; lessonId: string },
    actor: AuthenticatedUser,
  ): Result<{ percentComplete: number; courseCompleted: boolean }> {
    const enrollment = this.enrollments.byId(input.enrollmentId);
    if (!enrollment) return err('not-found', `Enrollment not found: ${input.enrollmentId}`);
    if (enrollment.userId !== actor.userId) {
      return err('forbidden', 'Only the enrolled learner records progress');
    }
    const course = this.courses.byId(enrollment.targetId);
    if (!course) return err('not-found', `Course not found: ${enrollment.targetId}`);
    const result = enrollment.completeLesson(
      input.lessonId,
      course.lessonIds(),
      course.completionRule,
      this.clock.now(),
    );
    if (!result.ok) return result;
    this.enrollments.save(enrollment);
    this.publisher.publishFrom('learning', enrollment);
    return ok({
      percentComplete: enrollment.percentComplete,
      courseCompleted: result.value.courseJustCompleted,
    });
  }
}
