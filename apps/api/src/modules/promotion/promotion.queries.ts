import { AuthenticatedUser } from '../../ports/auth.port';
import { Result, err, ok } from '../shared-kernel/result';
import {
  CompletionLedger,
  ReadinessSnapshot,
  RequirementSetRepository,
  SnapshotStore,
} from './promotion.repositories';

export class PromotionQueries {
  constructor(
    private readonly snapshots: SnapshotStore,
    private readonly sets: RequirementSetRepository,
    private readonly ledger: CompletionLedger,
    private readonly teamMemberIdsOf: (managerId: string) => string[],
  ) {}

  latestSnapshot(userId: string, requester: AuthenticatedUser): Result<ReadinessSnapshot | null> {
    const allowed =
      requester.userId === userId ||
      requester.role === 'admin' ||
      (requester.role === 'manager' && this.teamMemberIdsOf(requester.userId).includes(userId));
    if (!allowed) return err('forbidden', 'Readiness is visible to self, manager, admin');
    return ok(this.snapshots.latestFor(userId));
  }

  /** Gap report: "82% ready, missing: …" (master plan §7.7). */
  gapReport(userId: string, requester: AuthenticatedUser) {
    const snapshot = this.latestSnapshot(userId, requester);
    if (!snapshot.ok) return snapshot;
    if (!snapshot.value) return ok(null);
    const s = snapshot.value;
    return ok({
      userId,
      targetRoleLevel: s.targetRoleLevel,
      requirementSetVersion: s.requirementSetVersion,
      percentReady: s.percentReady,
      missing: s.missing.map((m) => ({ label: m.label, kind: m.kind, weight: m.weight })),
      satisfied: s.satisfied.map((m) => ({ label: m.label, kind: m.kind, weight: m.weight })),
      computedAt: s.computedAt,
    });
  }

  teamReadiness(actor: AuthenticatedUser) {
    if (actor.role !== 'manager' && actor.role !== 'admin') {
      return err('forbidden', 'promotion.read-team requires manager/admin');
    }
    const members = this.teamMemberIdsOf(actor.userId);
    return ok(
      members.map((userId) => {
        const s = this.snapshots.latestFor(userId);
        return {
          userId,
          percentReady: s?.percentReady ?? null,
          targetRoleLevel: s?.targetRoleLevel ?? null,
          pendingItems: s?.missing.length ?? null,
        };
      }),
    );
  }

  listRequirementSets() {
    return this.sets.list();
  }

  ledgerOf(userId: string) {
    return this.ledger.of(userId);
  }

  snapshotHistory(userId: string) {
    return this.snapshots.historyFor(userId);
  }
}
