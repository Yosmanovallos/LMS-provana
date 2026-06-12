import { AuthenticatedUser } from '../../../ports/auth.port';
import { IdPort } from '../../../ports/system.port';
import { DomainEventPublisher } from '../../shared-kernel/publisher';
import { Result, err, ok } from '../../shared-kernel/result';
import { Answer, Attempt } from '../domain/assessment';
import { AssessmentRepository, AttemptRepository } from '../assessment.repositories';

export class StartAttemptHandler {
  constructor(
    private readonly assessments: AssessmentRepository,
    private readonly attempts: AttemptRepository,
    private readonly ids: IdPort,
  ) {}

  execute(input: { assessmentId: string }, actor: AuthenticatedUser): Result<{ attemptId: string }> {
    const assessment = this.assessments.byId(input.assessmentId);
    if (!assessment || assessment.status !== 'published') {
      return err('not-found', `Published assessment not found: ${input.assessmentId}`);
    }
    const previous = this.attempts.byUserAndAssessment(actor.userId, input.assessmentId);
    if (previous.some((a) => a.status === 'in-progress')) {
      return err('conflict', 'An attempt is already in progress');
    }
    if (previous.some((a) => a.status === 'passed')) {
      return err('conflict', 'Assessment already passed');
    }
    const consumed = previous.filter((a) => a.status !== 'in-progress').length;
    if (consumed >= assessment.maxAttempts) {
      return err('invariant', `Max attempts (${assessment.maxAttempts}) reached`);
    }
    const attempt = new Attempt(this.ids.next(), actor.userId, input.assessmentId);
    this.attempts.save(attempt);
    return ok({ attemptId: attempt.id });
  }
}

export class SubmitAttemptHandler {
  constructor(
    private readonly assessments: AssessmentRepository,
    private readonly attempts: AttemptRepository,
    private readonly publisher: DomainEventPublisher,
  ) {}

  execute(
    input: { attemptId: string; answers: Answer[] },
    actor: AuthenticatedUser,
  ): Result<{ status: string; scorePct: number | null }> {
    const attempt = this.attempts.byId(input.attemptId);
    if (!attempt) return err('not-found', `Attempt not found: ${input.attemptId}`);
    if (attempt.userId !== actor.userId) return err('forbidden', 'Not your attempt');
    const assessment = this.assessments.byId(attempt.assessmentId);
    if (!assessment) return err('not-found', 'Assessment not found');
    const result = attempt.submit(input.answers, assessment);
    if (!result.ok) return result;
    this.attempts.save(attempt);
    this.publisher.publishFrom('assessment', attempt);
    return ok({ status: attempt.status, scorePct: attempt.scorePct });
  }
}
