import { AuthenticatedUser } from '../../../ports/auth.port';
import { FileStoragePort, UploadRequest } from '../../../ports/file-storage.port';
import { ClockPort, IdPort } from '../../../ports/system.port';
import { DomainEventPublisher } from '../../shared-kernel/publisher';
import { Result, err, ok } from '../../shared-kernel/result';
import { EvidenceItem } from '../domain/evidence-item';
import { EvidenceRepository } from '../evidence.repositories';

export class SubmitEvidenceHandler {
  constructor(
    private readonly evidence: EvidenceRepository,
    private readonly storage: FileStoragePort,
    private readonly publisher: DomainEventPublisher,
    private readonly clock: ClockPort,
    private readonly ids: IdPort,
  ) {}

  execute(
    input: {
      file: UploadRequest;
      description: string;
      targetRequirementId?: string;
      resubmissionOf?: string;
    },
    actor: AuthenticatedUser,
  ): Result<{ evidenceId: string }> {
    if (input.description.trim().length === 0) return err('validation', 'Description required');
    if (input.resubmissionOf) {
      const original = this.evidence.byId(input.resubmissionOf);
      if (!original) return err('not-found', 'Original evidence not found');
      if (original.userId !== actor.userId) return err('forbidden', 'Can only resubmit own evidence');
      if (original.status !== 'rejected') {
        return err('invariant', 'Only rejected evidence can be resubmitted');
      }
    }
    let fileRef;
    try {
      fileRef = this.storage.store(input.file); // validates mime allow-list + size
    } catch (e) {
      return err('validation', (e as Error).message);
    }
    const item = new EvidenceItem(
      this.ids.next(),
      actor.userId,
      fileRef,
      input.description.trim(),
      input.targetRequirementId ?? null,
      input.resubmissionOf ?? null,
      this.clock.now(),
    );
    this.evidence.save(item);
    this.publisher.publishFrom('evidence', item);
    return ok({ evidenceId: item.id });
  }
}
