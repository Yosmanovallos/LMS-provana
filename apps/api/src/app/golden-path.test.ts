import { describe, expect, it } from 'vitest';
import { FixedClock, SequentialIds } from '../adapters/system.adapter';
import { unwrap } from '../modules/shared-kernel/result';
import { buildContainer } from '../container';
import { seedDemoData } from './seed';

/** Whole-monolith integration: seed the demo scenario and verify every module's view. */
describe('golden path (seeded demo scenario)', () => {
  function seeded() {
    const container = buildContainer({ clock: new FixedClock(), ids: new SequentialIds('id') });
    const seed = seedDemoData(container);
    const ana = seed.personas.find((p) => p.displayName === 'Ana Quintero')!.userId;
    const marco = seed.personas.find((p) => p.role === 'manager')!.userId;
    return { container, seed, ana, marco };
  }

  it('Ana sits at 82% readiness with the three named gaps', () => {
    const { container, ana } = seeded();
    const report = unwrap(container.promotion.queries.gapReport(ana, { userId: ana, role: 'employee' }))!;
    expect(report.percentReady).toBe(82);
    expect(report.missing.map((m) => m.label).sort()).toEqual(
      ['Assessment A', 'Automation Fundamentals', 'Certification B'].sort(),
    );
  });

  it('cross-module effects of seeding: My Learning buckets, points, queue, inbox, analytics', () => {
    const { container, ana, marco } = seeded();

    const myLearning = container.learning.queries.getMyLearning(ana);
    expect(myLearning.completed).toHaveLength(2);
    expect(myLearning.todo.length + myLearning.active.length).toBeGreaterThanOrEqual(2);

    // 2 courses + 1 assessment = 250 points
    expect(container.gamification.queries.pointsOf(ana).total).toBe(250);
    expect(container.gamification.queries.leaderboard('weekly', 'global')[0]!.userId).toBe(ana);

    // Marco: one pending evidence in queue, inbox notified
    expect(container.evidence.queries.reviewQueue({ userId: marco, role: 'manager' })).toHaveLength(1);
    expect(container.notification.service.unreadCount(marco)).toBeGreaterThan(0);
    expect(container.email.sent.length).toBeGreaterThan(0);

    const teamReadiness = unwrap(container.promotion.queries.teamReadiness({ userId: marco, role: 'manager' }));
    expect(teamReadiness.find((t) => t.userId === ana)!.percentReady).toBe(82);

    expect(container.analytics.projections.teamProgress(marco).find((m) => m.userId === ana)!.completed).toBe(2);
  });

  it('closing the gaps drives readiness to 100% and fires PromotionEligible exactly once', () => {
    const { container, seed, ana, marco } = seeded();
    const anaActor = { userId: ana, role: 'employee' as const };
    const marcoActor = { userId: marco, role: 'manager' as const };
    const adminActor = { userId: seed.personas[0]!.userId, role: 'admin' as const };

    // 1) complete Automation Fundamentals
    const automation = seed.courseIds.automation!;
    const enrollment = container.learning.queries
      .userEnrollments(ana)
      .find((e) => e.targetId === automation && e.status === 'active')!;
    for (const lessonId of container.learning.queries.getCourse(automation)!.lessonIds()) {
      unwrap(container.learning.completeLesson.execute({ enrollmentId: enrollment.enrollmentId, lessonId }, anaActor));
    }

    // 2) pass Assessment A (practical → manager review)
    const assessmentA = seed.assessmentIds.assessmentA!;
    const { attemptId } = unwrap(container.assessment.startAttempt.execute({ assessmentId: assessmentA }, anaActor));
    const questions = container.assessment.queries.getAssessment(assessmentA)!.questions;
    unwrap(
      container.assessment.submitAttempt.execute(
        {
          attemptId,
          answers: [
            { questionId: questions[0]!.id, value: [1] },
            { questionId: questions[1]!.id, value: 'github.com/ana/login-e2e' },
          ],
        },
        anaActor,
      ),
    );
    expect(container.assessment.queries.reviewQueue(marcoActor).map((a) => a.attemptId)).toContain(attemptId);
    unwrap(
      container.assessment.reviewAttempt.execute(
        { attemptId, manualScores: [{ questionId: questions[1]!.id, points: 18 }], feedback: 'Great coverage' },
        marcoActor,
      ),
    );

    // 3) Certification B via manual admin issuance
    unwrap(container.certification.issueManual.execute({ userId: ana, name: 'Certification B' }, adminActor));

    const report = unwrap(container.promotion.queries.gapReport(ana, anaActor))!;
    expect(report.percentReady).toBe(100);
    expect(report.missing).toHaveLength(0);

    const eligible = container.outbox.all().filter((e) => e.type === 'PromotionEligible');
    expect(eligible).toHaveLength(1);
    // learner + manager notified
    expect(
      container.notification.service.inboxOf(ana).some((n) => n.title.includes('Promotion readiness')),
    ).toBe(true);
    expect(
      container.notification.service.inboxOf(marco).some((n) => n.title.includes('Promotion readiness')),
    ).toBe(true);

    // analytics rebuild stays consistent after the full flow
    const before = container.analytics.projections.completionRateByTeam();
    container.analytics.rebuild();
    expect(container.analytics.projections.completionRateByTeam()).toEqual(before);
  });
});
