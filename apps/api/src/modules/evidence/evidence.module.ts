import { FileStoragePort } from '../../ports/file-storage.port';
import { ClockPort, IdPort } from '../../ports/system.port';
import { DomainEventPublisher } from '../shared-kernel/publisher';
import { EvidenceQueries } from './evidence.queries';
import { InMemoryEvidenceRepository } from './evidence.repositories';
import { ReviewEvidenceHandler } from './features/review-evidence';
import { SubmitEvidenceHandler } from './features/submit-evidence';

export interface EvidenceModule {
  submit: SubmitEvidenceHandler;
  review: ReviewEvidenceHandler;
  queries: EvidenceQueries;
}

export function createEvidenceModule(deps: {
  publisher: DomainEventPublisher;
  clock: ClockPort;
  ids: IdPort;
  storage: FileStoragePort;
  isManagerOf: (managerId: string, userId: string) => boolean;
}): EvidenceModule {
  const repo = new InMemoryEvidenceRepository();
  return {
    submit: new SubmitEvidenceHandler(repo, deps.storage, deps.publisher, deps.clock, deps.ids),
    review: new ReviewEvidenceHandler(repo, deps.publisher, deps.clock, deps.isManagerOf),
    queries: new EvidenceQueries(repo, deps.isManagerOf),
  };
}
