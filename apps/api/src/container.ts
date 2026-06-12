import { ConsoleEmailAdapter } from './adapters/console-email.adapter';
import { DevAuthAdapter } from './adapters/dev-auth.adapter';
import { LocalFileStorageAdapter } from './adapters/local-file-storage.adapter';
import { SystemClock, UuidIds } from './adapters/system.adapter';
import { AuthPort } from './ports/auth.port';
import { ClockPort, IdPort } from './ports/system.port';
import { createAnalyticsModule, AnalyticsModule } from './modules/analytics/analytics.module';
import { createAssessmentModule, AssessmentModule } from './modules/assessment/assessment.module';
import { createCertificationModule, CertificationModule } from './modules/certification/certification.module';
import { createEvidenceModule, EvidenceModule } from './modules/evidence/evidence.module';
import { createGamificationModule, GamificationModule } from './modules/gamification/gamification.module';
import { createIdentityModule, IdentityModule } from './modules/identity/identity.module';
import { createLearningModule, LearningModule } from './modules/learning/learning.module';
import { createNotificationModule, NotificationModule } from './modules/notification/notification.module';
import { createOrganizationModule, OrganizationModule } from './modules/organization/organization.module';
import { createPromotionModule, PromotionModule } from './modules/promotion/promotion.module';
import { InProcessEventBus } from './modules/shared-kernel/event-bus';
import { InMemoryOutboxStore } from './modules/shared-kernel/outbox';
import { DomainEventPublisher, OutboxDispatcher } from './modules/shared-kernel/publisher';

export interface Container {
  outbox: InMemoryOutboxStore;
  bus: InProcessEventBus;
  publisher: DomainEventPublisher;
  clock: ClockPort;
  ids: IdPort;
  auth: AuthPort;
  email: ConsoleEmailAdapter;
  identity: IdentityModule;
  organization: OrganizationModule;
  learning: LearningModule;
  assessment: AssessmentModule;
  evidence: EvidenceModule;
  certification: CertificationModule;
  promotion: PromotionModule;
  gamification: GamificationModule;
  analytics: AnalyticsModule;
  notification: NotificationModule;
}

/**
 * Composition root: the ONLY place that touches every module. Cross-module reads are
 * injected as functions sourced from public query services — modules never import
 * each other (boundary lint enforces it).
 */
export function buildContainer(deps?: { clock?: ClockPort; ids?: IdPort }): Container {
  const clock = deps?.clock ?? new SystemClock();
  const ids = deps?.ids ?? new UuidIds();
  const outbox = new InMemoryOutboxStore();
  const bus = new InProcessEventBus();
  const dispatcher = new OutboxDispatcher(outbox, bus);
  const publisher = new DomainEventPublisher(outbox, dispatcher, ids, clock);
  const email = new ConsoleEmailAdapter(process.env.NODE_ENV !== 'test');
  const storage = new LocalFileStorageAdapter(ids);

  const identity = createIdentityModule({ publisher, ids });
  const organization = createOrganizationModule({
    publisher,
    bus,
    clock,
    ids,
    getUserRole: (userId) => identity.queries.getRole(userId),
  });

  const isManagerOf = (managerId: string, userId: string) =>
    organization.queries.isManagerOf(managerId, userId);

  const learning = createLearningModule({ publisher, bus, clock, ids, isManagerOf });
  const assessment = createAssessmentModule({ publisher, ids, isManagerOf });
  const evidence = createEvidenceModule({ publisher, clock, ids, storage, isManagerOf });
  const certification = createCertificationModule({ publisher, bus, clock, ids });
  const promotion = createPromotionModule({
    publisher,
    bus,
    clock,
    ids,
    profileContext: {
      roleLevelOf: (userId) => {
        const p = organization.queries.getProfile(userId);
        return p?.jobRoleId && p.jobLevelId
          ? { jobRoleId: p.jobRoleId, jobLevelId: p.jobLevelId }
          : null;
      },
      currentLevelSinceOf: (userId) =>
        organization.queries.getProfile(userId)?.currentLevelSince ?? null,
    },
    teamMemberIdsOf: (managerId) =>
      organization.queries.getTeamMembers(managerId).map((p) => p.userId),
  });
  const gamification = createGamificationModule({
    publisher,
    bus,
    clock,
    ids,
    isManagerOf,
    teamOf: (userId) => organization.queries.getProfile(userId)?.managerId ?? null,
  });
  const analytics = createAnalyticsModule({ bus, outbox });
  const notification = createNotificationModule({
    publisher,
    bus,
    clock,
    ids,
    email,
    emailOf: (userId) => identity.queries.getUser(userId)?.email ?? null,
    managerOf: (userId) => organization.queries.getProfile(userId)?.managerId ?? null,
    displayNameOf: (userId) => identity.queries.getUser(userId)?.displayName ?? userId,
  });

  return {
    outbox,
    bus,
    publisher,
    clock,
    ids,
    auth: new DevAuthAdapter(),
    email,
    identity,
    organization,
    learning,
    assessment,
    evidence,
    certification,
    promotion,
    gamification,
    analytics,
    notification,
  };
}
