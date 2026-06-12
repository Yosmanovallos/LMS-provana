import { Course } from './domain/course';
import { Enrollment } from './domain/enrollment';
import { CourseRepository, EnrollmentRepository, PathRepository } from './learning.repositories';

export interface EnrollmentView {
  enrollmentId: string;
  targetKind: string;
  targetId: string;
  title: string;
  status: string;
  percentComplete: number;
  dueDate: string | null;
  completedAt: string | null;
  source: string;
}

/** Buckets matching the EPAM-style My Learning hub tabs. */
export interface MyLearningView {
  todo: EnrollmentView[];
  active: EnrollmentView[];
  completed: EnrollmentView[];
}

export class LearningQueries {
  constructor(
    private readonly courses: CourseRepository,
    private readonly paths: PathRepository,
    private readonly enrollments: EnrollmentRepository,
  ) {}

  getCourse(id: string): Course | null {
    return this.courses.byId(id);
  }

  listPublishedCatalog() {
    return {
      courses: this.courses.list().filter((c) => c.status === 'published'),
      paths: this.paths.list().filter((p) => p.status === 'published'),
      programs: this.paths.listPrograms(),
    };
  }

  listAllCatalog() {
    return {
      courses: this.courses.list(),
      paths: this.paths.list(),
      programs: this.paths.listPrograms(),
    };
  }

  getEnrollment(id: string): Enrollment | null {
    return this.enrollments.byId(id);
  }

  /** Completed course ids per user — used by path logic and exposed for views. */
  completedCourseIds(userId: string): string[] {
    return this.enrollments
      .byUser(userId)
      .filter((e) => e.targetKind === 'course' && e.completedAt)
      .map((e) => e.targetId);
  }

  getMyLearning(userId: string): MyLearningView {
    const views = this.enrollments.byUser(userId).map((e) => this.toView(e));
    return {
      todo: views.filter((v) => v.status === 'active' && v.percentComplete === 0),
      active: views.filter((v) => v.status === 'active' && v.percentComplete > 0),
      completed: views.filter((v) => v.status === 'completed'),
    };
  }

  userEnrollments(userId: string): EnrollmentView[] {
    return this.enrollments.byUser(userId).map((e) => this.toView(e));
  }

  private toView(e: Enrollment): EnrollmentView {
    let title = e.targetId;
    if (e.targetKind === 'course') title = this.courses.byId(e.targetId)?.title ?? e.targetId;
    if (e.targetKind === 'path') title = this.paths.byId(e.targetId)?.title ?? e.targetId;
    if (e.targetKind === 'program') title = this.paths.programById(e.targetId)?.title ?? e.targetId;
    return {
      enrollmentId: e.id,
      targetKind: e.targetKind,
      targetId: e.targetId,
      title,
      status: e.status,
      percentComplete: e.percentComplete,
      dueDate: e.dueDate,
      completedAt: e.completedAt,
      source: e.source,
    };
  }
}
