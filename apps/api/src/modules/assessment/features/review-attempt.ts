import { AuthenticatedUser } from '../../../ports/auth.port';
import { DomainEventPublisher } from '../../shared-kernel/publisher';
import { Result, err, ok } from '../../shared-kernel/result';
import { AssessmentRepository, AttemptRepository } from '../assessment.repositories';

export class ReviewAttemptHandler {
  constructor(
    private readonly assessments: AssessmentRepository,
    private readonly attempts: AttemptRepository,
    private readonly publisher: DomainEventPublisher,
    private readonly isManagerOf: (managerId: string, userId: string) => boolean,
  ) {}

  execute(
    input: {
      attemptId: string;
      manualScores: { questionId: string; points: number }[];
      feedback?: string;
    },
    actor: AuthenticatedUser,
  ): Result<{ status: string; scorePct: number | null }> {
    const attempt = this.attempts.byId(input.attemptId);
    if (!attempt) return err('not-found', `Attempt not found: ${input.attemptId}`);
    const allowed =
      actor.role === 'admin' ||
      (actor.role === 'manager' && this.isManagerOf(actor.userId, attempt.userId));
    if (!allowed) return err('forbidden', 'Only the learner’s manager or an admin may review');
    const assessment = this.assessments.byId(attempt.assessmentId);
    if (!assessment) return err('not-found', 'Assessment not found');
    const result = attempt.review(actor.userId, input.manualScores, input.feedback, assessment);
    if (!result.ok) return result;
    this.attempts.save(attempt);
    this.publisher.publishFrom('assessment', attempt);
    return ok({ status: attempt.status, scorePct: attempt.scorePct });
  }
}
