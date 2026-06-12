import { AuthenticatedUser } from '../../../ports/auth.port';
import { ClockPort } from '../../../ports/system.port';
import { DomainEventPublisher } from '../../shared-kernel/publisher';
import { Result, err, ok } from '../../shared-kernel/result';
import { EvidenceItem } from '../domain/evidence-item';
import { EvidenceRepository } from '../evidence.repositories';

export class ReviewEvidenceHandler {
  constructor(
    private readonly evidence: EvidenceRepository,
    private readonly publisher: DomainEventPublisher,
    private readonly clock: ClockPort,
    private readonly isManagerOf: (managerId: string, userId: string) => boolean,
  ) {}

  startReview(input: { evidenceId: string }, actor: AuthenticatedUser): Result<void> {
    return this.withAuthorized(input.evidenceId, actor, (item) =>
      item.startReview(actor.userId, this.clock.now()),
    );
  }

  approve(input: { evidenceId: string; note?: string }, actor: AuthenticatedUser): Result<void> {
    return this.withAuthorized(input.evidenceId, actor, (item) =>
      item.approve(actor.userId, this.clock.now(), input.note),
    );
  }

  reject(input: { evidenceId: string; feedback: string }, actor: AuthenticatedUser): Result<void> {
    return this.withAuthorized(input.evidenceId, actor, (item) =>
      item.reject(actor.userId, input.feedback, this.clock.now()),
    );
  }

  /** Only the submitter's assigned manager or an admin may act (module invariant). */
  private withAuthorized(
    evidenceId: string,
    actor: AuthenticatedUser,
    action: (item: EvidenceItem) => Result<void>,
  ): Result<void> {
    const item = this.evidence.byId(evidenceId);
    if (!item) return err('not-found', `Evidence not found: ${evidenceId}`);
    const allowed =
      actor.role === 'admin' ||
      (actor.role === 'manager' && this.isManagerOf(actor.userId, item.userId));
    if (!allowed) return err('forbidden', 'Only the submitter’s manager or an admin may review');
    const result = action(item);
    if (!result.ok) return result;
    this.evidence.save(item);
    this.publisher.publishFrom('evidence', item);
    return ok(undefined);
  }
}
