import { RoleLevel } from '@lms/contracts';
import { AuthenticatedUser } from '../../../ports/auth.port';
import { IdPort } from '../../../ports/system.port';
import { Result, err, ok } from '../../shared-kernel/result';
import { CompletionRule, Course, CourseModule } from '../domain/course';
import { PathItem, StudyPath } from '../domain/study-path';
import { CourseRepository, PathRepository } from '../learning.repositories';

function requireAdmin(actor: AuthenticatedUser): Result<void> {
  return actor.role === 'admin' ? ok(undefined) : err('forbidden', 'catalog.manage requires admin');
}

export class AuthorCatalogHandler {
  constructor(
    private readonly courses: CourseRepository,
    private readonly paths: PathRepository,
    private readonly ids: IdPort,
  ) {}

  createCourse(
    input: {
      title: string;
      modules: { title: string; lessons: { title: string; type: 'video' | 'reading' | 'exercise'; durationMin: number }[] }[];
      completionRule?: CompletionRule;
      quizAssessmentId?: string;
    },
    actor: AuthenticatedUser,
  ): Result<{ courseId: string }> {
    const auth = requireAdmin(actor);
    if (!auth.ok) return auth;
    if (input.title.trim().length === 0) return err('validation', 'Title required');
    const modules: CourseModule[] = input.modules.map((m) => ({
      id: this.ids.next(),
      title: m.title,
      lessons: m.lessons.map((l) => ({ id: this.ids.next(), ...l })),
    }));
    const course = new Course(
      this.ids.next(),
      input.title.trim(),
      modules,
      input.completionRule ?? 'all-lessons',
      input.quizAssessmentId ?? null,
    );
    this.courses.save(course);
    return ok({ courseId: course.id });
  }

  publishCourse(courseId: string, actor: AuthenticatedUser): Result<void> {
    const auth = requireAdmin(actor);
    if (!auth.ok) return auth;
    const course = this.courses.byId(courseId);
    if (!course) return err('not-found', `Course not found: ${courseId}`);
    const result = course.publish();
    if (!result.ok) return result;
    this.courses.save(course);
    return ok(undefined);
  }

  createProgram(
    input: { title: string; courseIds: string[]; startsAt?: string; endsAt?: string },
    actor: AuthenticatedUser,
  ): Result<{ programId: string }> {
    const auth = requireAdmin(actor);
    if (!auth.ok) return auth;
    for (const courseId of input.courseIds) {
      if (!this.courses.byId(courseId)) return err('validation', `Unknown course: ${courseId}`);
    }
    const programId = this.ids.next();
    this.paths.saveProgram({ id: programId, status: 'published', ...input });
    return ok({ programId });
  }

  createPath(
    input: { title: string; targetRoleLevel: RoleLevel; items: PathItem[] },
    actor: AuthenticatedUser,
  ): Result<{ pathId: string }> {
    const auth = requireAdmin(actor);
    if (!auth.ok) return auth;
    const path = new StudyPath(this.ids.next(), input.title, input.targetRoleLevel, input.items);
    this.paths.save(path);
    return ok({ pathId: path.id });
  }

  publishPath(pathId: string, actor: AuthenticatedUser): Result<void> {
    const auth = requireAdmin(actor);
    if (!auth.ok) return auth;
    const path = this.paths.byId(pathId);
    if (!path) return err('not-found', `Path not found: ${pathId}`);
    const result = path.publish();
    if (!result.ok) return result;
    this.paths.save(path);
    return ok(undefined);
  }
}
