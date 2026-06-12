import { Assessment, Attempt } from './domain/assessment';

export interface AssessmentRepository {
  byId(id: string): Assessment | null;
  save(assessment: Assessment): void;
  list(): Assessment[];
}

export interface AttemptRepository {
  byId(id: string): Attempt | null;
  byUserAndAssessment(userId: string, assessmentId: string): Attempt[];
  awaitingReview(): Attempt[];
  byUser(userId: string): Attempt[];
  save(attempt: Attempt): void;
}

export class InMemoryAssessmentRepository implements AssessmentRepository {
  private items = new Map<string, Assessment>();
  byId(id: string) {
    return this.items.get(id) ?? null;
  }
  save(a: Assessment) {
    this.items.set(a.id, a);
  }
  list() {
    return [...this.items.values()];
  }
}

export class InMemoryAttemptRepository implements AttemptRepository {
  private items = new Map<string, Attempt>();
  byId(id: string) {
    return this.items.get(id) ?? null;
  }
  byUserAndAssessment(userId: string, assessmentId: string) {
    return [...this.items.values()].filter(
      (a) => a.userId === userId && a.assessmentId === assessmentId,
    );
  }
  awaitingReview() {
    return [...this.items.values()].filter((a) => a.status === 'awaiting-review');
  }
  byUser(userId: string) {
    return [...this.items.values()].filter((a) => a.userId === userId);
  }
  save(a: Attempt) {
    this.items.set(a.id, a);
  }
}
