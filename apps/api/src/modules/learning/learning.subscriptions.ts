import { EventPayload } from '@lms/contracts';
import { ClockPort, IdPort } from '../../ports/system.port';
import { EventSubscriber } from '../shared-kernel/event-bus';
import { DomainEventPublisher } from '../shared-kernel/publisher';
import { Enrollment } from './domain/enrollment';
import { CourseRepository, EnrollmentRepository, PathRepository } from './learning.repositories';

export interface LearningSubscriptionDeps {
  enrollments: EnrollmentRepository;
  courses: CourseRepository;
  paths: PathRepository;
  publisher: DomainEventPublisher;
  clock: ClockPort;
  ids: IdPort;
}

/** JobLevelChanged → auto-enroll into published paths targeting the new role-level. */
export function autoEnrollSubscriber(deps: LearningSubscriptionDeps): EventSubscriber {
  return {
    name: 'learning.auto-enroll',
    eventTypes: ['JobLevelChanged'],
    handle(event) {
      const p = event.payload as EventPayload<'JobLevelChanged'>;
      const matching = deps.paths
        .list()
        .filter(
          (path) =>
            path.status === 'published' &&
            path.targetRoleLevel.jobRoleId === p.jobRoleId &&
            path.targetRoleLevel.jobLevelId === p.toLevelId,
        );
      for (const path of matching) {
        if (deps.enrollments.byUserAndTarget(p.userId, 'path', path.id)) continue; // idempotent
        const enrollment = new Enrollment(deps.ids.next(), p.userId, 'path', path.id, 'assigned', 'system');
        enrollment.recordCreated();
        deps.enrollments.save(enrollment);
        deps.publisher.publishFrom('learning', enrollment);
      }
    },
  };
}

/** AssessmentPassed → complete active quiz-pass course enrollments linked to that assessment. */
export function quizPassSubscriber(deps: LearningSubscriptionDeps): EventSubscriber {
  return {
    name: 'learning.quiz-pass',
    eventTypes: ['AssessmentPassed'],
    handle(event) {
      const p = event.payload as EventPayload<'AssessmentPassed'>;
      const quizCourses = deps.courses
        .list()
        .filter((c) => c.completionRule === 'quiz-pass' && c.quizAssessmentId === p.assessmentId);
      for (const course of quizCourses) {
        const enrollment = deps.enrollments.byUserAndTarget(p.userId, 'course', course.id);
        if (enrollment && enrollment.completeViaQuiz(deps.clock.now())) {
          deps.enrollments.save(enrollment);
          deps.publisher.publishFrom('learning', enrollment);
        }
      }
    },
  };
}

/** CourseCompleted → check the user's active path enrollments for full completion. */
export function pathCompletionSubscriber(deps: LearningSubscriptionDeps): EventSubscriber {
  return {
    name: 'learning.path-completion',
    eventTypes: ['CourseCompleted'],
    handle(event) {
      const p = event.payload as EventPayload<'CourseCompleted'>;
      const completedCourseIds = new Set(
        deps.enrollments
          .byUser(p.userId)
          .filter((e) => e.targetKind === 'course' && e.completedAt)
          .map((e) => e.targetId),
      );
      const pathEnrollments = deps.enrollments
        .byUser(p.userId)
        .filter((e) => e.targetKind === 'path' && e.status === 'active');
      for (const enrollment of pathEnrollments) {
        const path = deps.paths.byId(enrollment.targetId);
        if (!path) continue;
        // Path completion = all course items (programs expanded) completed.
        // Assessment items surface in ToDo but do not gate path completion.
        const required = path.items.flatMap((item) => {
          if (item.kind === 'course') return [item.refId];
          if (item.kind === 'program') return deps.paths.programById(item.refId)?.courseIds ?? [];
          return [];
        });
        if (required.length > 0 && required.every((id) => completedCourseIds.has(id))) {
          if (enrollment.completeAsPath(deps.clock.now())) {
            deps.enrollments.save(enrollment);
            deps.publisher.publishFrom('learning', enrollment);
          }
        }
      }
    },
  };
}
