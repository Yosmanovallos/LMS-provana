import { describe, expect, it } from 'vitest';
import { createTestKernel } from '../shared-kernel/testing';
import { AnalyticsProjections, createAnalyticsModule } from './analytics.module';

function seedEvents(kernel: ReturnType<typeof createTestKernel>) {
  kernel.publisher.publishPending('organization', [
    { type: 'EmployeeAssignedToManager', aggregateId: 'u-1', payload: { userId: 'u-1', managerId: 'mgr-1', assignedBy: 'a' } },
    { type: 'EmployeeAssignedToManager', aggregateId: 'u-2', payload: { userId: 'u-2', managerId: 'mgr-1', assignedBy: 'a' } },
  ]);
  kernel.publisher.publishPending('learning', [
    { type: 'EnrollmentCreated', aggregateId: 'e-1', payload: { enrollmentId: 'e-1', userId: 'u-1', targetKind: 'course', targetId: 'c-1', source: 'assigned' } },
    { type: 'EnrollmentCreated', aggregateId: 'e-2', payload: { enrollmentId: 'e-2', userId: 'u-2', targetKind: 'course', targetId: 'c-1', source: 'self' } },
    { type: 'CourseCompleted', aggregateId: 'e-1', payload: { userId: 'u-1', enrollmentId: 'e-1', courseId: 'c-1' } },
  ]);
  kernel.publisher.publishPending('promotion', [
    { type: 'ReadinessRecalculated', aggregateId: 'u-1', payload: { userId: 'u-1', snapshotId: 's1', percentReady: 40 } },
    { type: 'ReadinessRecalculated', aggregateId: 'u-1', payload: { userId: 'u-1', snapshotId: 's2', percentReady: 82 } },
  ]);
}

describe('analytics projections', () => {
  it('computes completion rate, velocity, active learners, team progress, readiness distribution', () => {
    const kernel = createTestKernel();
    const analytics = createAnalyticsModule(kernel);
    seedEvents(kernel);

    expect(analytics.projections.completionRateByTeam()).toEqual([
      { managerId: 'mgr-1', enrolled: 2, completed: 1, ratePct: 50 },
    ]);
    expect(analytics.projections.learningVelocity()).toEqual([{ week: '2026-W24', completions: 1 }]);
    expect(analytics.projections.activeLearners()).toEqual([{ week: '2026-W24', count: 2 }]);
    expect(analytics.projections.teamProgress('mgr-1')).toEqual([
      { userId: 'u-1', enrolled: 1, completed: 1 },
      { userId: 'u-2', enrolled: 1, completed: 0 },
    ]);
    // latest snapshot wins: 82 → bucket 76-99
    expect(analytics.projections.readinessDistribution().find((b) => b.bucket === '76-99')!.count).toBe(1);
    expect(analytics.projections.readinessDistribution().find((b) => b.bucket === '26-50')!.count).toBe(0);
  });

  it('rebuild from the outbox log equals incrementally built state', () => {
    const kernel = createTestKernel();
    const analytics = createAnalyticsModule(kernel);
    seedEvents(kernel);
    const before = {
      rate: analytics.projections.completionRateByTeam(),
      velocity: analytics.projections.learningVelocity(),
      team: analytics.projections.teamProgress('mgr-1'),
    };
    analytics.rebuild();
    expect(analytics.projections.completionRateByTeam()).toEqual(before.rate);
    expect(analytics.projections.learningVelocity()).toEqual(before.velocity);
    expect(analytics.projections.teamProgress('mgr-1')).toEqual(before.team);

    // a fresh projection fed the same log also matches (disposability)
    const fresh = new AnalyticsProjections();
    fresh.rebuild(kernel.outbox.all());
    expect(fresh.completionRateByTeam()).toEqual(before.rate);
  });

  it('reassignment moves a member between teams', () => {
    const kernel = createTestKernel();
    const analytics = createAnalyticsModule(kernel);
    kernel.publisher.publishPending('organization', [
      { type: 'EmployeeAssignedToManager', aggregateId: 'u-1', payload: { userId: 'u-1', managerId: 'mgr-1', assignedBy: 'a' } },
      { type: 'EmployeeAssignedToManager', aggregateId: 'u-1', payload: { userId: 'u-1', managerId: 'mgr-2', assignedBy: 'a' } },
    ]);
    expect(analytics.projections.teamProgress('mgr-1')).toEqual([]);
    expect(analytics.projections.teamProgress('mgr-2')).toHaveLength(1);
  });
});
