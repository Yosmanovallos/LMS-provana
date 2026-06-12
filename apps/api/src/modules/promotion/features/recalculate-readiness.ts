import { RoleLevel } from '@lms/contracts';
import { ClockPort, IdPort } from '../../../ports/system.port';
import { DomainEventPublisher } from '../../shared-kernel/publisher';
import { computeReadiness } from '../domain/requirement-set';
import {
  CompletionLedger,
  RequirementSetRepository,
  SnapshotStore,
} from '../promotion.repositories';

export interface PromotionProfileContext {
  /** Injected from organization via the container (no cross-module import). */
  roleLevelOf(userId: string): RoleLevel | null;
  currentLevelSinceOf(userId: string): string | null;
}

export class RecalculateReadinessService {
  constructor(
    private readonly ledger: CompletionLedger,
    private readonly sets: RequirementSetRepository,
    private readonly snapshots: SnapshotStore,
    private readonly profileContext: PromotionProfileContext,
    private readonly publisher: DomainEventPublisher,
    private readonly clock: ClockPort,
    private readonly ids: IdPort,
  ) {}

  recalculate(userId: string): void {
    const roleLevel = this.profileContext.roleLevelOf(userId);
    if (!roleLevel) return; // no job role assigned yet — nothing to compute against
    const set = this.sets.activeFor(roleLevel);
    if (!set) return;
    const result = computeReadiness(set, this.ledger.of(userId), {
      currentLevelSince: this.profileContext.currentLevelSinceOf(userId),
      now: this.clock.now(),
    });
    const snapshot = {
      ...result,
      snapshotId: this.ids.next(),
      userId,
      targetRoleLevel: set.toRoleLevel,
      requirementSetId: set.id,
      requirementSetVersion: set.version,
      computedAt: this.clock.now().toISOString(),
    };
    this.snapshots.append(snapshot);
    this.publisher.publishPending('promotion', [
      {
        type: 'ReadinessRecalculated',
        aggregateId: userId,
        payload: { userId, snapshotId: snapshot.snapshotId, percentReady: snapshot.percentReady },
      },
    ]);
    if (
      snapshot.percentReady === 100 &&
      this.snapshots.markEligibleEmitted(userId, set.id, set.version)
    ) {
      this.publisher.publishPending('promotion', [
        {
          type: 'PromotionEligible',
          aggregateId: userId,
          payload: {
            userId,
            targetRoleLevel: set.toRoleLevel,
            requirementSetVersion: set.version,
          },
        },
      ]);
    }
  }
}
