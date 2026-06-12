import { AggregateRoot } from '../../shared-kernel/aggregate-root';
import { Result, err, ok } from '../../shared-kernel/result';
import { StoredFileRef } from '../../../ports/file-storage.port';

export type EvidenceStatus = 'submitted' | 'under-review' | 'approved' | 'rejected';

export interface Transition {
  from: EvidenceStatus | null;
  to: EvidenceStatus;
  byUserId: string;
  at: string;
  note?: string;
}

export class EvidenceItem extends AggregateRoot {
  status: EvidenceStatus = 'submitted';
  reviewerId: string | null = null;
  decidedAt: string | null = null;
  feedback: string | null = null;
  /** Append-only audit trail of every state transition. */
  readonly history: Transition[] = [];

  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly file: StoredFileRef,
    public readonly description: string,
    public readonly targetRequirementId: string | null,
    public readonly resubmissionOf: string | null,
    submittedAt: Date,
  ) {
    super();
    this.history.push({ from: null, to: 'submitted', byUserId: userId, at: submittedAt.toISOString() });
    this.recordEvent('EvidenceSubmitted', this.id, {
      evidenceId: this.id,
      userId: this.userId,
      ...(this.targetRequirementId ? { targetRequirementId: this.targetRequirementId } : {}),
    });
  }

  startReview(reviewerId: string, at: Date): Result<void> {
    if (this.status !== 'submitted') return err('invariant', `Cannot start review from ${this.status}`);
    this.transition('under-review', reviewerId, at);
    return ok(undefined);
  }

  approve(reviewerId: string, at: Date, note?: string): Result<void> {
    if (this.status !== 'under-review' && this.status !== 'submitted') {
      return err('invariant', `Cannot approve from ${this.status} (approved items are immutable)`);
    }
    this.reviewerId = reviewerId;
    this.decidedAt = at.toISOString();
    this.feedback = note ?? null;
    this.transition('approved', reviewerId, at, note);
    this.recordEvent('EvidenceApproved', this.id, {
      evidenceId: this.id,
      userId: this.userId,
      reviewerId,
      ...(this.targetRequirementId ? { targetRequirementId: this.targetRequirementId } : {}),
    });
    return ok(undefined);
  }

  reject(reviewerId: string, feedback: string, at: Date): Result<void> {
    if (this.status !== 'under-review' && this.status !== 'submitted') {
      return err('invariant', `Cannot reject from ${this.status}`);
    }
    if (feedback.trim().length === 0) return err('validation', 'Rejection requires feedback');
    this.reviewerId = reviewerId;
    this.decidedAt = at.toISOString();
    this.feedback = feedback;
    this.transition('rejected', reviewerId, at, feedback);
    this.recordEvent('EvidenceRejected', this.id, {
      evidenceId: this.id,
      userId: this.userId,
      reviewerId,
      feedback,
    });
    return ok(undefined);
  }

  private transition(to: EvidenceStatus, byUserId: string, at: Date, note?: string): void {
    this.history.push({ from: this.status, to, byUserId, at: at.toISOString(), ...(note ? { note } : {}) });
    this.status = to;
  }
}
