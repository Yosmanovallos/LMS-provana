import { EnrollmentTargetKind } from '@lms/contracts';
import { AuthenticatedUser } from '../../../ports/auth.port';
import { IdPort } from '../../../ports/system.port';
import { DomainEventPublisher } from '../../shared-kernel/publisher';
import { Result, err, ok } from '../../shared-kernel/result';
import { Enrollment } from '../domain/enrollment';
import { CourseRepository, EnrollmentRepository, PathRepository } from '../learning.repositories';

export class EnrollUserHandler {
  constructor(
    private readonly enrollments: EnrollmentRepository,
    private readonly courses: CourseRepository,
    private readonly paths: PathRepository,
    private readonly publisher: DomainEventPublisher,
    private readonly ids: IdPort,
    /** Manager-scope check injected from organization via the container. */
    private readonly isManagerOf: (managerId: string, userId: string) => boolean,
  ) {}

  execute(
    input: {
      userId: string;
      targetKind: EnrollmentTargetKind;
      targetId: string;
      dueDate?: string;
    },
    actor: AuthenticatedUser,
  ): Result<{ enrollmentId: string }> {
    const self = input.userId === actor.userId;
    if (!self && actor.role === 'employee') {
      return err('forbidden', 'Employees can only self-enroll');
    }
    if (!self && actor.role === 'manager' && !this.isManagerOf(actor.userId, input.userId)) {
      return err('forbidden', 'Managers can only assign learning to their own team');
    }
    const published = this.targetIsPublished(input.targetKind, input.targetId);
    if (!published.ok) return published;
    if (this.enrollments.byUserAndTarget(input.userId, input.targetKind, input.targetId)) {
      return err('conflict', 'Already enrolled in this target');
    }
    const enrollment = new Enrollment(
      this.ids.next(),
      input.userId,
      input.targetKind,
      input.targetId,
      self ? 'self' : 'assigned',
      self ? null : actor.userId,
      input.dueDate ?? null,
    );
    enrollment.recordCreated();
    this.enrollments.save(enrollment);
    this.publisher.publishFrom('learning', enrollment);
    return ok({ enrollmentId: enrollment.id });
  }

  private targetIsPublished(kind: EnrollmentTargetKind, id: string): Result<void> {
    if (kind === 'course') {
      const course = this.courses.byId(id);
      if (!course) return err('not-found', `Course not found: ${id}`);
      if (course.status !== 'published') return err('invariant', 'Only published courses can be enrolled in');
    } else if (kind === 'path') {
      const path = this.paths.byId(id);
      if (!path) return err('not-found', `Path not found: ${id}`);
      if (path.status !== 'published') return err('invariant', 'Only published paths can be enrolled in');
    } else if (kind === 'program') {
      if (!this.paths.programById(id)) return err('not-found', `Program not found: ${id}`);
    }
    // assessment targets are validated by the assessment module when attempted
    return ok(undefined);
  }
}
