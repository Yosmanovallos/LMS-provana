import { EnrollmentTargetKind } from '@lms/contracts';
import { Course } from './domain/course';
import { Enrollment } from './domain/enrollment';
import { Program, StudyPath } from './domain/study-path';

export interface CourseRepository {
  byId(id: string): Course | null;
  save(course: Course): void;
  list(): Course[];
}

export interface PathRepository {
  byId(id: string): StudyPath | null;
  save(path: StudyPath): void;
  list(): StudyPath[];
  saveProgram(program: Program): void;
  programById(id: string): Program | null;
  listPrograms(): Program[];
}

export interface EnrollmentRepository {
  byId(id: string): Enrollment | null;
  byUser(userId: string): Enrollment[];
  byUserAndTarget(userId: string, targetKind: EnrollmentTargetKind, targetId: string): Enrollment | null;
  save(enrollment: Enrollment): void;
  list(): Enrollment[];
}

export class InMemoryCourseRepository implements CourseRepository {
  private items = new Map<string, Course>();
  byId(id: string) {
    return this.items.get(id) ?? null;
  }
  save(course: Course) {
    this.items.set(course.id, course);
  }
  list() {
    return [...this.items.values()];
  }
}

export class InMemoryPathRepository implements PathRepository {
  private paths = new Map<string, StudyPath>();
  private programs = new Map<string, Program>();
  byId(id: string) {
    return this.paths.get(id) ?? null;
  }
  save(path: StudyPath) {
    this.paths.set(path.id, path);
  }
  list() {
    return [...this.paths.values()];
  }
  saveProgram(program: Program) {
    this.programs.set(program.id, program);
  }
  programById(id: string) {
    return this.programs.get(id) ?? null;
  }
  listPrograms() {
    return [...this.programs.values()];
  }
}

export class InMemoryEnrollmentRepository implements EnrollmentRepository {
  private items = new Map<string, Enrollment>();
  byId(id: string) {
    return this.items.get(id) ?? null;
  }
  byUser(userId: string) {
    return this.list().filter((e) => e.userId === userId);
  }
  byUserAndTarget(userId: string, targetKind: EnrollmentTargetKind, targetId: string) {
    return (
      this.list().find(
        (e) => e.userId === userId && e.targetKind === targetKind && e.targetId === targetId,
      ) ?? null
    );
  }
  save(enrollment: Enrollment) {
    this.items.set(enrollment.id, enrollment);
  }
  list() {
    return [...this.items.values()];
  }
}
