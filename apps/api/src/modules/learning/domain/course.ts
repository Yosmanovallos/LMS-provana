import { AggregateRoot } from '../../shared-kernel/aggregate-root';
import { Result, err, ok } from '../../shared-kernel/result';

export type LessonType = 'video' | 'reading' | 'exercise';
export type CatalogStatus = 'draft' | 'published' | 'archived';
export type CompletionRule = 'all-lessons' | 'quiz-pass';

export interface Lesson {
  id: string;
  title: string;
  type: LessonType;
  durationMin: number;
}

export interface CourseModule {
  id: string;
  title: string;
  lessons: Lesson[];
}

export class Course extends AggregateRoot {
  status: CatalogStatus = 'draft';
  version = 1;

  constructor(
    public readonly id: string,
    public title: string,
    public modules: CourseModule[],
    public completionRule: CompletionRule = 'all-lessons',
    /** Required when completionRule is quiz-pass. */
    public quizAssessmentId: string | null = null,
  ) {
    super();
  }

  publish(): Result<void> {
    if (this.status === 'published') return ok(undefined);
    if (this.status === 'archived') return err('invariant', 'Archived course cannot be published');
    if (this.lessonIds().length === 0) return err('validation', 'Course needs at least one lesson');
    if (this.completionRule === 'quiz-pass' && !this.quizAssessmentId) {
      return err('validation', 'quiz-pass courses must link an assessment');
    }
    this.status = 'published';
    return ok(undefined);
  }

  /** Editing published content bumps the version (master plan invariant). */
  updateContent(modules: CourseModule[]): void {
    this.modules = modules;
    if (this.status === 'published') this.version += 1;
  }

  lessonIds(): string[] {
    return this.modules.flatMap((m) => m.lessons.map((l) => l.id));
  }

  hasLesson(lessonId: string): boolean {
    return this.lessonIds().includes(lessonId);
  }
}
