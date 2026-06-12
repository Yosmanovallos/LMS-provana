import { AuthenticatedUser } from '../../ports/auth.port';
import { Result, err, ok } from '../shared-kernel/result';
import { EvidenceItem, Transition } from './domain/evidence-item';
import { EvidenceRepository } from './evidence.repositories';

export interface EvidenceView {
  evidenceId: string;
  userId: string;
  description: string;
  status: string;
  targetRequirementId: string | null;
  resubmissionOf: string | null;
  feedback: string | null;
  reviewerId: string | null;
  decidedAt: string | null;
  file: { storageKey: string; mime: string; sizeBytes: number };
  history: Transition[];
}

export class EvidenceQueries {
  constructor(
    private readonly evidence: EvidenceRepository,
    private readonly isManagerOf: (managerId: string, userId: string) => boolean,
  ) {}

  listForUser(userId: string): EvidenceView[] {
    return this.evidence.byUser(userId).map(toView);
  }

  /** Visibility: owner, their manager, admins only (master plan §16 secure uploads). */
  getItem(id: string, requester: AuthenticatedUser): Result<EvidenceView> {
    const item = this.evidence.byId(id);
    if (!item) return err('not-found', `Evidence not found: ${id}`);
    const visible =
      requester.userId === item.userId ||
      requester.role === 'admin' ||
      (requester.role === 'manager' && this.isManagerOf(requester.userId, item.userId));
    if (!visible) return err('forbidden', 'Not visible to requester');
    return ok(toView(item));
  }

  reviewQueue(actor: AuthenticatedUser): EvidenceView[] {
    const queue = this.evidence.pendingReview();
    const scoped =
      actor.role === 'admin'
        ? queue
        : queue.filter((e) => this.isManagerOf(actor.userId, e.userId));
    return scoped.map(toView);
  }
}

function toView(e: EvidenceItem): EvidenceView {
  return {
    evidenceId: e.id,
    userId: e.userId,
    description: e.description,
    status: e.status,
    targetRequirementId: e.targetRequirementId,
    resubmissionOf: e.resubmissionOf,
    feedback: e.feedback,
    reviewerId: e.reviewerId,
    decidedAt: e.decidedAt,
    file: { storageKey: e.file.storageKey, mime: e.file.mime, sizeBytes: e.file.sizeBytes },
    history: [...e.history],
  };
}
