import { ClockPort, IdPort } from '../../ports/system.port';
import { InProcessEventBus } from '../shared-kernel/event-bus';
import { DomainEventPublisher } from '../shared-kernel/publisher';
import { AuthorCatalogHandler } from './features/author-catalog';
import { CompleteLessonHandler } from './features/complete-lesson';
import { EnrollUserHandler } from './features/enroll-user';
import { LearningQueries } from './learning.queries';
import {
  InMemoryCourseRepository,
  InMemoryEnrollmentRepository,
  InMemoryPathRepository,
} from './learning.repositories';
import {
  autoEnrollSubscriber,
  pathCompletionSubscriber,
  quizPassSubscriber,
} from './learning.subscriptions';

export interface LearningModule {
  authorCatalog: AuthorCatalogHandler;
  enrollUser: EnrollUserHandler;
  completeLesson: CompleteLessonHandler;
  queries: LearningQueries;
}

export function createLearningModule(deps: {
  publisher: DomainEventPublisher;
  bus: InProcessEventBus;
  clock: ClockPort;
  ids: IdPort;
  isManagerOf: (managerId: string, userId: string) => boolean;
}): LearningModule {
  const courses = new InMemoryCourseRepository();
  const paths = new InMemoryPathRepository();
  const enrollments = new InMemoryEnrollmentRepository();
  const subDeps = { courses, paths, enrollments, publisher: deps.publisher, clock: deps.clock, ids: deps.ids };
  deps.bus.subscribe(autoEnrollSubscriber(subDeps));
  deps.bus.subscribe(quizPassSubscriber(subDeps));
  deps.bus.subscribe(pathCompletionSubscriber(subDeps));
  return {
    authorCatalog: new AuthorCatalogHandler(courses, paths, deps.ids),
    enrollUser: new EnrollUserHandler(enrollments, courses, paths, deps.publisher, deps.ids, deps.isManagerOf),
    completeLesson: new CompleteLessonHandler(enrollments, courses, deps.publisher, deps.clock),
    queries: new LearningQueries(courses, paths, enrollments),
  };
}
