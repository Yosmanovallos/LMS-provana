import { describe, expect, it } from 'vitest';
import { RoleLevel } from '@lms/contracts';
import { AuthenticatedUser } from '../../ports/auth.port';
import { unwrap } from '../shared-kernel/result';
import { createTestKernel } from '../shared-kernel/testing';
import { RequirementInput } from './features/manage-requirement-sets';
import { createPromotionModule } from './promotion.module';

const admin: AuthenticatedUser = { userId: 'admin-1', role: 'admin' };
const qaJunior: RoleLevel = { jobRoleId: 'qa', jobLevelId: 'junior' };
const qaMid: RoleLevel = { jobRoleId: 'qa', jobLevelId: 'mid' };

function setup(opts?: { currentLevelSince?: string | null; team?: string[] }) {
  const kernel = createTestKernel();
  const roleLevels = new Map<string, RoleLevel>([['u-1', qaJunior]]);
  const promotion = createPromotionModule({
    ...kernel,
    profileContext: {
      roleLevelOf: (id) => roleLevels.get(id) ?? null,
      currentLevelSinceOf: () =>
        opts?.currentLevelSince === undefined ? '2025-06-11T00:00:00.000Z' : opts.currentLevelSince,
    },
    teamMemberIdsOf: (managerId) => (managerId === 'mgr-1' ? (opts?.team ?? ['u-1']) : []),
  });
  return { kernel, promotion, roleLevels };
}

/** The master-plan §7.7 demo scenario: QA Junior → Mid at 82% with named gaps. */
const masterPlanRequirements: RequirementInput[] = [
  { kind: 'course', courseId: 'c-testing', label: 'Testing Fundamentals', weight: 10 },
  { kind: 'course', courseId: 'c-agile', label: 'Agile Basics', weight: 10 },
  { kind: 'course', courseId: 'c-automation', label: 'Automation Fundamentals', weight: 6 },
  { kind: 'assessment', assessmentId: 'as-a', label: 'Assessment A', weight: 8 },
  { kind: 'assessment', assessmentId: 'as-theory', label: 'QA Theory Assessment', weight: 20 },
  { kind: 'certification', certificationName: 'Certification B', label: 'Certification B', weight: 4 },
  { kind: 'evidence', requirementKey: 'req-project-evidence', label: 'Project Evidence', weight: 22 },
  { kind: 'tenure', months: 6, label: '6 months tenure', weight: 20 },
];

function activeSet(promotion: ReturnType<typeof setup>['promotion'], requirements = masterPlanRequirements) {
  const { requirementSetId } = unwrap(
    promotion.manageSets.create({ fromRoleLevel: qaJunior, toRoleLevel: qaMid, requirements }, admin),
  );
  unwrap(promotion.manageSets.activate(requirementSetId, admin));
  return requirementSetId;
}

const courseCompleted = (courseId: string, n: string) => ({
  type: 'CourseCompleted' as const,
  aggregateId: n,
  payload: { userId: 'u-1', enrollmentId: n, courseId },
});

describe('readiness calculation (core domain)', () => {
  it('reproduces the 82% QA Junior→Mid scenario with named missing items', () => {
    const { kernel, promotion } = setup();
    activeSet(promotion);

    kernel.publisher.publishPending('learning', [
      courseCompleted('c-testing', 'e-1'),
      courseCompleted('c-agile', 'e-2'),
    ]);
    kernel.publisher.publishPending('assessment', [
      { type: 'AssessmentPassed', aggregateId: 'at-1', payload: { userId: 'u-1', assessmentId: 'as-theory', attemptId: 'at-1', scorePct: 85 } },
    ]);
    kernel.publisher.publishPending('evidence', [
      { type: 'EvidenceApproved', aggregateId: 'ev-1', payload: { evidenceId: 'ev-1', userId: 'u-1', targetRequirementId: 'req-project-evidence', reviewerId: 'mgr-1' } },
    ]);

    const report = unwrap(promotion.queries.gapReport('u-1', { userId: 'u-1', role: 'employee' }))!;
    expect(report.percentReady).toBe(82);
    expect(report.targetRoleLevel).toEqual(qaMid);
    expect(report.missing.map((m) => m.label).sort()).toEqual(
      ['Assessment A', 'Automation Fundamentals', 'Certification B'].sort(),
    );
  });

  it('ledger ingestion is idempotent: redelivered events do not duplicate facts or snapshots', () => {
    const { kernel, promotion } = setup();
    activeSet(promotion);
    const [record] = kernel.publisher.publishPending('learning', [courseCompleted('c-testing', 'e-1')]);
    kernel.bus.dispatch(record!); // simulated redelivery
    expect(promotion.queries.ledgerOf('u-1')).toHaveLength(1);
    expect(promotion.queries.snapshotHistory('u-1')).toHaveLength(1);
  });

  it('tenure: not satisfied without level start date or below months threshold', () => {
    const noTenure = setup({ currentLevelSince: null });
    activeSet(noTenure.promotion, [
      { kind: 'tenure', months: 6, label: 'Tenure', weight: 50 },
      { kind: 'course', courseId: 'c-x', label: 'X', weight: 50 },
    ]);
    noTenure.kernel.publisher.publishPending('learning', [courseCompleted('c-x', 'e-1')]);
    expect(unwrap(noTenure.promotion.queries.gapReport('u-1', admin))!.percentReady).toBe(50);

    const young = setup({ currentLevelSince: '2026-04-11T00:00:00.000Z' }); // 2 months before fixed clock
    activeSet(young.promotion, [
      { kind: 'tenure', months: 6, label: 'Tenure', weight: 50 },
      { kind: 'course', courseId: 'c-x', label: 'X', weight: 50 },
    ]);
    young.kernel.publisher.publishPending('learning', [courseCompleted('c-x', 'e-1')]);
    expect(unwrap(young.promotion.queries.gapReport('u-1', admin))!.percentReady).toBe(50);
  });
});

describe('PromotionEligible & versioning', () => {
  it('fires PromotionEligible exactly once on first 100% per set version', () => {
    const { kernel, promotion } = setup();
    activeSet(promotion, [
      { kind: 'course', courseId: 'c-1', label: 'C1', weight: 1 },
      { kind: 'course', courseId: 'c-2', label: 'C2', weight: 1 },
    ]);
    kernel.publisher.publishPending('learning', [courseCompleted('c-1', 'e-1')]);
    expect(kernel.outbox.all().filter((e) => e.type === 'PromotionEligible')).toHaveLength(0);
    kernel.publisher.publishPending('learning', [courseCompleted('c-2', 'e-2')]);
    expect(kernel.outbox.all().filter((e) => e.type === 'PromotionEligible')).toHaveLength(1);
    // an extra fact triggers recalculation at 100% again — but no second eligibility event
    kernel.publisher.publishPending('learning', [courseCompleted('c-extra', 'e-3')]);
    expect(kernel.outbox.all().filter((e) => e.type === 'PromotionEligible')).toHaveLength(1);
  });

  it('editing an active set creates version n+1; old snapshots keep the old version', () => {
    const { kernel, promotion } = setup();
    const v1Id = activeSet(promotion, [{ kind: 'course', courseId: 'c-1', label: 'C1', weight: 1 }]);
    kernel.publisher.publishPending('learning', [courseCompleted('c-1', 'e-1')]);
    const v1Snapshot = promotion.queries.snapshotHistory('u-1').at(-1)!;
    expect(v1Snapshot.requirementSetVersion).toBe(1);
    expect(v1Snapshot.percentReady).toBe(100);

    const { requirementSetId: v2Id, version } = unwrap(
      promotion.manageSets.newVersion(
        {
          requirementSetId: v1Id,
          requirements: [
            { kind: 'course', courseId: 'c-1', label: 'C1', weight: 1 },
            { kind: 'assessment', assessmentId: 'as-new', label: 'New Bar', weight: 1 },
          ],
        },
        admin,
      ),
    );
    expect(version).toBe(2);
    unwrap(promotion.manageSets.activate(v2Id, admin));

    const sets = promotion.queries.listRequirementSets();
    expect(sets.find((s) => s.id === v1Id)!.status).toBe('superseded');
    expect(sets.find((s) => s.id === v2Id)!.status).toBe('active');

    // recalculation now runs against v2 (50%), old snapshot still says v1/100%
    kernel.publisher.publishPending('learning', [courseCompleted('c-other', 'e-2')]);
    const latest = promotion.queries.snapshotHistory('u-1').at(-1)!;
    expect(latest.requirementSetVersion).toBe(2);
    expect(latest.percentReady).toBe(50);
    expect(promotion.queries.snapshotHistory('u-1')[0]!.requirementSetVersion).toBe(1);
  });

  it('JobLevelChanged re-targets: new role-level picks up its own active set', () => {
    const { kernel, promotion, roleLevels } = setup();
    activeSet(promotion, [{ kind: 'course', courseId: 'c-1', label: 'C1', weight: 1 }]);
    // a second transition set: QA Mid → Senior
    const { requirementSetId } = unwrap(
      promotion.manageSets.create(
        {
          fromRoleLevel: qaMid,
          toRoleLevel: { jobRoleId: 'qa', jobLevelId: 'senior' },
          requirements: [{ kind: 'course', courseId: 'c-adv', label: 'Advanced', weight: 1 }],
        },
        admin,
      ),
    );
    unwrap(promotion.manageSets.activate(requirementSetId, admin));

    roleLevels.set('u-1', qaMid);
    kernel.publisher.publishPending('organization', [
      { type: 'JobLevelChanged', aggregateId: 'u-1', payload: { userId: 'u-1', jobRoleId: 'qa', fromLevelId: 'junior', toLevelId: 'mid', changedBy: 'admin-1' } },
    ]);
    const latest = promotion.queries.snapshotHistory('u-1').at(-1)!;
    expect(latest.targetRoleLevel).toEqual({ jobRoleId: 'qa', jobLevelId: 'senior' });
    expect(latest.percentReady).toBe(0);
  });
});

describe('authorization', () => {
  it('readiness visible to self, own manager, admin — not to others', () => {
    const { kernel, promotion } = setup();
    activeSet(promotion);
    kernel.publisher.publishPending('learning', [courseCompleted('c-testing', 'e-1')]);

    expect(promotion.queries.latestSnapshot('u-1', { userId: 'u-1', role: 'employee' }).ok).toBe(true);
    expect(promotion.queries.latestSnapshot('u-1', { userId: 'mgr-1', role: 'manager' }).ok).toBe(true);
    expect(promotion.queries.latestSnapshot('u-1', admin).ok).toBe(true);
    expect(promotion.queries.latestSnapshot('u-1', { userId: 'u-2', role: 'employee' }).ok).toBe(false);
    expect(promotion.queries.latestSnapshot('u-1', { userId: 'mgr-2', role: 'manager' }).ok).toBe(false);

    const team = unwrap(promotion.queries.teamReadiness({ userId: 'mgr-1', role: 'manager' }));
    expect(team).toHaveLength(1);
    expect(team[0]).toMatchObject({ userId: 'u-1' });
    expect(promotion.queries.teamReadiness({ userId: 'u-1', role: 'employee' }).ok).toBe(false);
  });

  it('requirement-set management is admin-only and validates weights', () => {
    const { promotion } = setup();
    expect(
      promotion.manageSets.create(
        { fromRoleLevel: qaJunior, toRoleLevel: qaMid, requirements: masterPlanRequirements },
        { userId: 'mgr-1', role: 'manager' },
      ).ok,
    ).toBe(false);
    expect(
      promotion.manageSets.create(
        { fromRoleLevel: qaJunior, toRoleLevel: qaMid, requirements: [{ kind: 'course', courseId: 'c', label: 'C', weight: 0 }] },
        admin,
      ).ok,
    ).toBe(false);
  });
});
