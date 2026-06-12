import { AuthenticatedUser } from '../../ports/auth.port';
import { Answer, Assessment, Attempt } from './domain/assessment';
import { AssessmentRepository, AttemptRepository } from './assessment.repositories';

export interface AttemptView {
  attemptId: string;
  userId: string;
  assessmentId: string;
  assessmentTitle: string;
  status: string;
  scorePct: number | null;
  feedback: string | null;
  /** Submitted answers — reviewers need them; queue/own-attempt reads are already scoped. */
  answers: Answer[];
}

export class AssessmentQueries {
  constructor(
    private readonly assessments: AssessmentRepository,
    private readonly attempts: AttemptRepository,
    private readonly isManagerOf: (managerId: string, userId: string) => boolean,
  ) {}

  getAssessment(id: string): Assessment | null {
    return this.assessments.byId(id);
  }

  listPublished(): Assessment[] {
    return this.assessments.list().filter((a) => a.status === 'published');
  }

  listAll(): Assessment[] {
    return this.assessments.list();
  }

  attemptsOf(userId: string): AttemptView[] {
    return this.attempts.byUser(userId).map((a) => this.toView(a));
  }

  /** Manager sees own team's queue; admin sees all. */
  reviewQueue(actor: AuthenticatedUser): AttemptView[] {
    const queue = this.attempts.awaitingReview();
    const scoped =
      actor.role === 'admin'
        ? queue
        : queue.filter((a) => this.isManagerOf(actor.userId, a.userId));
    return scoped.map((a) => this.toView(a));
  }

  private toView(a: Attempt): AttemptView {
    return {
      attemptId: a.id,
      userId: a.userId,
      assessmentId: a.assessmentId,
      assessmentTitle: this.assessments.byId(a.assessmentId)?.title ?? a.assessmentId,
      status: a.status,
      scorePct: a.scorePct,
      feedback: a.feedback,
      answers: [...a.answers],
    };
  }
}
