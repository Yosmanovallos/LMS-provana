import { describe, expect, it } from 'vitest';
import { unwrap } from '../shared-kernel/result';
import { createTestKernel } from '../shared-kernel/testing';
import { createGamificationModule } from './gamification.module';

function setup(teamOf: (u: string) => string | null = () => 'team-a') {
  const kernel = createTestKernel();
  const gamification = createGamificationModule({
    ...kernel,
    isManagerOf: (m, u) => m === 'mgr-1' && u === 'u-1',
    teamOf,
  });
  return { kernel, gamification };
}

const courseCompleted = (userId: string, enrollmentId: string) => ({
  type: 'CourseCompleted' as const,
  aggregateId: enrollmentId,
  payload: { userId, enrollmentId, courseId: 'c-1' },
});

describe('point ledger', () => {
  it('awards rule-configured points per event; replaying the same event awards once', () => {
    const { kernel, gamification } = setup();
    const event = courseCompleted('u-1', 'e-1');
    const [record] = kernel.publisher.publishPending('learning', [event]);
    // simulate at-least-once redelivery straight to the ledger path
    kernel.bus.dispatch(record!);
    kernel.bus.dispatch(record!);

    expect(gamification.queries.pointsOf('u-1').total).toBe(100);
    expect(kernel.outbox.all().filter((e) => e.type === 'PointsAwarded')).toHaveLength(1);
  });

  it('rule config drives points; daily cap stops awards', () => {
    const { kernel, gamification } = setup();
    gamification.rules.update('course-completed', 100, 250);
    kernel.publisher.publishPending('learning', [
      courseCompleted('u-1', 'e-1'),
      courseCompleted('u-1', 'e-2'),
      courseCompleted('u-1', 'e-3'), // would exceed the 250 cap → skipped
    ]);
    expect(gamification.queries.pointsOf('u-1').total).toBe(200);
  });

  it('stacks sources: assessment +50, certification +300, recognition +200', () => {
    const { kernel, gamification } = setup();
    kernel.publisher.publishPending('assessment', [
      { type: 'AssessmentPassed', aggregateId: 'a1', payload: { userId: 'u-1', assessmentId: 'as', attemptId: 'a1', scorePct: 80 } },
    ]);
    kernel.publisher.publishPending('certification', [
      { type: 'CertificationEarned', aggregateId: 'ct1', payload: { certificationId: 'ct1', userId: 'u-1', name: 'X', source: 'manual' } },
    ]);
    unwrap(gamification.recognition.execute({ userId: 'u-1', note: 'Nice' }, { userId: 'mgr-1', role: 'manager' }));
    expect(gamification.queries.pointsOf('u-1').total).toBe(550);
  });

  it('recognition is manager-of/admin only', () => {
    const { gamification } = setup();
    expect(gamification.recognition.execute({ userId: 'u-2' }, { userId: 'mgr-1', role: 'manager' }).ok).toBe(false);
    expect(gamification.recognition.execute({ userId: 'u-1' }, { userId: 'u-2', role: 'employee' }).ok).toBe(false);
    expect(gamification.recognition.execute({ userId: 'u-1' }, { userId: 'admin', role: 'admin' }).ok).toBe(true);
  });
});

describe('achievements', () => {
  it('grants once at thresholds (first course, 1000 points)', () => {
    const { kernel, gamification } = setup();
    kernel.publisher.publishPending('learning', [courseCompleted('u-1', 'e-1')]);
    expect(gamification.queries.achievementsOf('u-1').map((a) => a.id)).toEqual(['first-course']);

    // 10 certifications x 300 → crosses 1000
    for (let i = 0; i < 4; i++) {
      kernel.publisher.publishPending('certification', [
        { type: 'CertificationEarned', aggregateId: `ct${i}`, payload: { certificationId: `ct${i}`, userId: 'u-1', name: `C${i}`, source: 'manual' } },
      ]);
    }
    const ids = gamification.queries.achievementsOf('u-1').map((a) => a.id);
    expect(ids).toContain('first-thousand');
    expect(ids.filter((i) => i === 'first-thousand')).toHaveLength(1);
    expect(kernel.outbox.all().filter((e) => e.type === 'AchievementUnlocked')).toHaveLength(2);
  });
});

describe('leaderboards', () => {
  it('materializes ranked boards with shared ranks on ties, global and team scope', () => {
    const { kernel, gamification } = setup((u) => (u === 'u-3' ? 'team-b' : 'team-a'));
    kernel.publisher.publishPending('learning', [
      courseCompleted('u-1', 'e-1'),
      courseCompleted('u-2', 'e-2'),
      courseCompleted('u-3', 'e-3'),
      courseCompleted('u-3', 'e-4'),
    ]);
    gamification.leaderboards.materialize();

    const global = gamification.queries.leaderboard('weekly', 'global');
    expect(global).toEqual([
      { userId: 'u-3', points: 200, rank: 1 },
      { userId: 'u-1', points: 100, rank: 2 },
      { userId: 'u-2', points: 100, rank: 2 }, // tie shares rank
    ]);
    expect(gamification.queries.leaderboard('monthly', 'team', 'team-a').map((e) => e.userId).sort()).toEqual(['u-1', 'u-2']);
    expect(gamification.queries.leaderboard('annual', 'team', 'team-b')).toHaveLength(1);
    // read before/without materialization returns the last materialized state, not live compute
    expect(gamification.queries.leaderboard('quarterly', 'team', 'team-c')).toEqual([]);
  });

  it('only counts entries within the period window', () => {
    const { kernel, gamification } = setup();
    kernel.publisher.publishPending('learning', [courseCompleted('u-1', 'e-old')]);
    kernel.clock.advanceDays(40); // past weekly + monthly windows
    kernel.publisher.publishPending('learning', [courseCompleted('u-1', 'e-new')]);
    gamification.leaderboards.materialize();
    expect(gamification.queries.leaderboard('weekly', 'global')[0]!.points).toBe(100);
    expect(gamification.queries.leaderboard('annual', 'global')[0]!.points).toBe(200);
  });
});
