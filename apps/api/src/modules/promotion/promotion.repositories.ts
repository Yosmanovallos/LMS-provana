import { RoleLevel } from '@lms/contracts';
import { LedgerFact, ReadinessResult, RequirementSet } from './domain/requirement-set';

export interface ReadinessSnapshot extends ReadinessResult {
  snapshotId: string;
  userId: string;
  targetRoleLevel: RoleLevel;
  requirementSetId: string;
  requirementSetVersion: number;
  computedAt: string;
}

/** Append-only, idempotent on sourceEventId. */
export class CompletionLedger {
  private facts: LedgerFact[] = [];
  private bySource = new Set<string>();

  append(fact: LedgerFact): boolean {
    if (this.bySource.has(fact.sourceEventId)) return false;
    this.bySource.add(fact.sourceEventId);
    this.facts.push(fact);
    return true;
  }

  of(userId: string): LedgerFact[] {
    return this.facts.filter((f) => f.userId === userId);
  }

  all(): LedgerFact[] {
    return [...this.facts];
  }
}

export class RequirementSetRepository {
  private sets = new Map<string, RequirementSet>();

  save(set: RequirementSet): void {
    this.sets.set(set.id, set);
  }
  byId(id: string): RequirementSet | null {
    return this.sets.get(id) ?? null;
  }
  /** The single active set whose fromRoleLevel matches the user's current role-level. */
  activeFor(fromRoleLevel: RoleLevel): RequirementSet | null {
    return (
      this.list().find(
        (s) =>
          s.status === 'active' &&
          s.fromRoleLevel.jobRoleId === fromRoleLevel.jobRoleId &&
          s.fromRoleLevel.jobLevelId === fromRoleLevel.jobLevelId,
      ) ?? null
    );
  }
  activeByLineage(lineageId: string): RequirementSet | null {
    return this.list().find((s) => s.lineageId === lineageId && s.status === 'active') ?? null;
  }
  list(): RequirementSet[] {
    return [...this.sets.values()];
  }
}

/** Append-only snapshot store; old snapshots keep the version they were computed with. */
export class SnapshotStore {
  private snapshots: ReadinessSnapshot[] = [];
  private eligibleEmitted = new Set<string>();

  append(snapshot: ReadinessSnapshot): void {
    this.snapshots.push(snapshot);
  }

  latestFor(userId: string): ReadinessSnapshot | null {
    for (let i = this.snapshots.length - 1; i >= 0; i--) {
      if (this.snapshots[i]!.userId === userId) return this.snapshots[i]!;
    }
    return null;
  }

  historyFor(userId: string): ReadinessSnapshot[] {
    return this.snapshots.filter((s) => s.userId === userId);
  }

  /** PromotionEligible fires once per (user, set, version). */
  markEligibleEmitted(userId: string, setId: string, version: number): boolean {
    const key = `${userId}|${setId}|${version}`;
    if (this.eligibleEmitted.has(key)) return false;
    this.eligibleEmitted.add(key);
    return true;
  }
}
