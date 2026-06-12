import { IdPort } from '../../ports/system.port';
import { DomainEventPublisher } from '../shared-kernel/publisher';
import { AssessmentQueries } from './assessment.queries';
import {
  InMemoryAssessmentRepository,
  InMemoryAttemptRepository,
} from './assessment.repositories';
import { AuthorAssessmentHandler } from './features/author-assessment';
import { ReviewAttemptHandler } from './features/review-attempt';
import { StartAttemptHandler, SubmitAttemptHandler } from './features/take-assessment';

export interface AssessmentModule {
  author: AuthorAssessmentHandler;
  startAttempt: StartAttemptHandler;
  submitAttempt: SubmitAttemptHandler;
  reviewAttempt: ReviewAttemptHandler;
  queries: AssessmentQueries;
}

export function createAssessmentModule(deps: {
  publisher: DomainEventPublisher;
  ids: IdPort;
  isManagerOf: (managerId: string, userId: string) => boolean;
}): AssessmentModule {
  const assessments = new InMemoryAssessmentRepository();
  const attempts = new InMemoryAttemptRepository();
  return {
    author: new AuthorAssessmentHandler(assessments, deps.ids),
    startAttempt: new StartAttemptHandler(assessments, attempts, deps.ids),
    submitAttempt: new SubmitAttemptHandler(assessments, attempts, deps.publisher),
    reviewAttempt: new ReviewAttemptHandler(assessments, attempts, deps.publisher, deps.isManagerOf),
    queries: new AssessmentQueries(assessments, attempts, deps.isManagerOf),
  };
}
