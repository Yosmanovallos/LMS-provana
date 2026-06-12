import { RoleLevel } from '@lms/contracts';
import { AuthenticatedUser } from '../../../ports/auth.port';
import { ClockPort, IdPort } from '../../../ports/system.port';
import { Result, err, ok } from '../../shared-kernel/result';
import { Requirement, RequirementSet } from '../domain/requirement-set';
import { RequirementSetRepository } from '../promotion.repositories';

export type RequirementInput = { label: string; weight: number } & (
  | { kind: 'course'; courseId: string }
  | { kind: 'assessment'; assessmentId: string }
  | { kind: 'certification'; certificationName: string }
  | { kind: 'evidence'; requirementKey: string }
  | { kind: 'tenure'; months: number }
);

export class ManageRequirementSetsHandler {
  constructor(
    private readonly sets: RequirementSetRepository,
    private readonly clock: ClockPort,
    private readonly ids: IdPort,
  ) {}

  create(
    input: { fromRoleLevel: RoleLevel; toRoleLevel: RoleLevel; requirements: RequirementInput[] },
    actor: AuthenticatedUser,
  ): Result<{ requirementSetId: string }> {
    if (actor.role !== 'admin') return err('forbidden', 'requirement-sets.manage requires admin');
    const validated = this.validate(input.requirements);
    if (!validated.ok) return validated;
    const set: RequirementSet = {
      id: this.ids.next(),
      lineageId: this.ids.next(),
      fromRoleLevel: input.fromRoleLevel,
      toRoleLevel: input.toRoleLevel,
      version: 1,
      status: 'draft',
      effectiveFrom: this.clock.now().toISOString(),
      requirements: input.requirements.map((r) => ({ id: this.ids.next(), ...r }) as Requirement),
    };
    this.sets.save(set);
    return ok({ requirementSetId: set.id });
  }

  activate(requirementSetId: string, actor: AuthenticatedUser): Result<void> {
    if (actor.role !== 'admin') return err('forbidden', 'requirement-sets.manage requires admin');
    const set = this.sets.byId(requirementSetId);
    if (!set) return err('not-found', `Requirement set not found: ${requirementSetId}`);
    if (set.status !== 'draft') return err('invariant', 'Only drafts can be activated');
    if (set.requirements.length === 0) return err('validation', 'Requirement set needs requirements');
    // one active set per transition: supersede the currently active version
    const current = this.sets.activeByLineage(set.lineageId) ?? this.sets.activeFor(set.fromRoleLevel);
    if (current) {
      current.status = 'superseded';
      this.sets.save(current);
    }
    set.status = 'active';
    this.sets.save(set);
    return ok(undefined);
  }

  /**
   * Editing an active set never mutates it (auditability): creates a draft version n+1
   * in the same lineage. Activating it supersedes the old version; existing snapshots
   * keep referencing the version they were computed with.
   */
  newVersion(
    input: { requirementSetId: string; requirements: RequirementInput[] },
    actor: AuthenticatedUser,
  ): Result<{ requirementSetId: string; version: number }> {
    if (actor.role !== 'admin') return err('forbidden', 'requirement-sets.manage requires admin');
    const base = this.sets.byId(input.requirementSetId);
    if (!base) return err('not-found', `Requirement set not found: ${input.requirementSetId}`);
    const validated = this.validate(input.requirements);
    if (!validated.ok) return validated;
    const latestVersion = Math.max(
      ...this.sets.list().filter((s) => s.lineageId === base.lineageId).map((s) => s.version),
    );
    const next: RequirementSet = {
      id: this.ids.next(),
      lineageId: base.lineageId,
      fromRoleLevel: base.fromRoleLevel,
      toRoleLevel: base.toRoleLevel,
      version: latestVersion + 1,
      status: 'draft',
      effectiveFrom: this.clock.now().toISOString(),
      requirements: input.requirements.map((r) => ({ id: this.ids.next(), ...r }) as Requirement),
    };
    this.sets.save(next);
    return ok({ requirementSetId: next.id, version: next.version });
  }

  private validate(requirements: RequirementInput[]): Result<void> {
    for (const r of requirements) {
      if (r.weight <= 0) return err('validation', 'Requirement weight must be positive');
      if (r.kind === 'tenure' && r.months <= 0) return err('validation', 'Tenure months must be positive');
    }
    return ok(undefined);
  }
}
