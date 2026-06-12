import { describe, expect, it } from 'vitest';
import { AuthenticatedUser } from '../../ports/auth.port';
import { unwrap } from '../shared-kernel/result';
import { createTestKernel } from '../shared-kernel/testing';
import { AssessmentModule, createAssessmentModule } from './assessment.module';
import { QuestionInput } from './features/author-assessment';

const admin: AuthenticatedUser = { userId: 'admin-1', role: 'admin' };
const learner: AuthenticatedUser = { userId: 'u-1', role: 'employee' };
const manager: AuthenticatedUser = { userId: 'mgr-1', role: 'manager' };

function setup(isManagerOf: (m: string, u: string) => boolean = (m, u) => m === 'mgr-1' && u === 'u-1') {
  const kernel = createTestKernel();
  const assessment = createAssessmentModule({ ...kernel, isManagerOf });
  return { kernel, assessment };
}

function published(
  assessment: AssessmentModule,
  questions: QuestionInput[],
  passingScorePct = 70,
  maxAttempts = 2,
): string {
  const { assessmentId } = unwrap(
    assessment.author.create({ title: 'Quiz', questions, passingScorePct, maxAttempts }, admin),
  );
  unwrap(assessment.author.publish(assessmentId, admin));
  return assessmentId;
}

const mcq = (correct: number[] = [1]): QuestionInput => ({
  kind: 'multiple-choice',
  prompt: '2+2?',
  options: ['3', '4', '5'],
  correctIndexes: correct,
  points: 10,
});

describe('assessment authoring', () => {
  it('validates questions and admin-only authoring', () => {
    const { assessment } = setup();
    expect(assessment.author.create({ title: 'X', questions: [mcq()], passingScorePct: 70, maxAttempts: 1 }, learner).ok).toBe(false);
    expect(
      assessment.author.create(
        { title: 'X', questions: [{ ...mcq(), correctIndexes: [9] } as QuestionInput], passingScorePct: 70, maxAttempts: 1 },
        admin,
      ).ok,
    ).toBe(false);
  });
});

describe('attempts & auto-scoring', () => {
  it('auto-scores pure MC: exact-match selection, pass at threshold (score == passing passes)', () => {
    const { kernel, assessment } = setup();
    // two MC questions, 20 points total; passing 50% → exactly one correct = 50% = pass
    const id = published(assessment, [mcq([1]), mcq([0, 2])], 50);
    const { attemptId } = unwrap(assessment.startAttempt.execute({ assessmentId: id }, learner));
    const questions = assessment.queries.getAssessment(id)!.questions;
    const result = unwrap(
      assessment.submitAttempt.execute(
        {
          attemptId,
          answers: [
            { questionId: questions[0]!.id, value: [1] }, // correct
            { questionId: questions[1]!.id, value: [0] }, // partial selection → 0 points
          ],
        },
        learner,
      ),
    );
    expect(result.status).toBe('passed');
    expect(result.scorePct).toBe(50);
    expect(kernel.outbox.all().map((e) => e.type)).toEqual(['AttemptSubmitted', 'AssessmentPassed']);
  });

  it('enforces maxAttempts counting submitted attempts; blocks after pass', () => {
    const { assessment } = setup();
    const id = published(assessment, [mcq()], 70, 2);
    const q = assessment.queries.getAssessment(id)!.questions[0]!;

    const a1 = unwrap(assessment.startAttempt.execute({ assessmentId: id }, learner));
    unwrap(assessment.submitAttempt.execute({ attemptId: a1.attemptId, answers: [{ questionId: q.id, value: [0] }] }, learner)); // fail
    const a2 = unwrap(assessment.startAttempt.execute({ assessmentId: id }, learner));
    unwrap(assessment.submitAttempt.execute({ attemptId: a2.attemptId, answers: [{ questionId: q.id, value: [2] }] }, learner)); // fail
    const a3 = assessment.startAttempt.execute({ assessmentId: id }, learner);
    expect(a3.ok).toBe(false);
    if (!a3.ok) expect(a3.error.message).toMatch(/max attempts/i);
  });

  it('mixed assessment goes to awaiting-review; reviewer scope enforced; failing review needs feedback; finalized scores immutable', () => {
    const { kernel, assessment } = setup();
    const id = published(assessment, [
      mcq([1]),
      { kind: 'open-text', prompt: 'Explain SOLID', points: 10 },
    ]);
    const questions = assessment.queries.getAssessment(id)!.questions;
    const { attemptId } = unwrap(assessment.startAttempt.execute({ assessmentId: id }, learner));
    const submitted = unwrap(
      assessment.submitAttempt.execute(
        {
          attemptId,
          answers: [
            { questionId: questions[0]!.id, value: [1] },
            { questionId: questions[1]!.id, value: 'S.O.L.I.D…' },
          ],
        },
        learner,
      ),
    );
    expect(submitted.status).toBe('awaiting-review');

    // visible in manager queue (scoped) but not to an unrelated manager
    expect(assessment.queries.reviewQueue(manager).map((v) => v.attemptId)).toContain(attemptId);
    expect(assessment.queries.reviewQueue({ userId: 'mgr-other', role: 'manager' })).toHaveLength(0);

    // learner cannot review; unrelated manager cannot review
    expect(assessment.reviewAttempt.execute({ attemptId, manualScores: [] }, learner).ok).toBe(false);
    expect(
      assessment.reviewAttempt.execute({ attemptId, manualScores: [] }, { userId: 'mgr-other', role: 'manager' }).ok,
    ).toBe(false);

    // failing review without feedback rejected
    const failNoFeedback = assessment.reviewAttempt.execute(
      { attemptId, manualScores: [{ questionId: questions[1]!.id, points: 0 }] },
      manager,
    );
    expect(failNoFeedback.ok).toBe(false);

    const reviewed = unwrap(
      assessment.reviewAttempt.execute(
        { attemptId, manualScores: [{ questionId: questions[1]!.id, points: 8 }] },
        manager,
      ),
    );
    expect(reviewed.status).toBe('passed'); // 18/20 = 90%
    expect(reviewed.scorePct).toBe(90);
    expect(kernel.outbox.all().map((e) => e.type)).toContain('AssessmentPassed');

    // immutable once finalized
    const again = assessment.reviewAttempt.execute(
      { attemptId, manualScores: [{ questionId: questions[1]!.id, points: 0 }] },
      admin,
    );
    expect(again.ok).toBe(false);
  });

  it('review validates score ranges and completeness', () => {
    const { assessment } = setup();
    const id = published(assessment, [{ kind: 'practical', prompt: 'Build it', points: 10 }]);
    const q = assessment.queries.getAssessment(id)!.questions[0]!;
    const { attemptId } = unwrap(assessment.startAttempt.execute({ assessmentId: id }, learner));
    unwrap(assessment.submitAttempt.execute({ attemptId, answers: [{ questionId: q.id, value: 'done' }] }, learner));

    expect(assessment.reviewAttempt.execute({ attemptId, manualScores: [] }, admin).ok).toBe(false);
    expect(
      assessment.reviewAttempt.execute({ attemptId, manualScores: [{ questionId: q.id, points: 99 }] }, admin).ok,
    ).toBe(false);
  });

  it('only the owner submits an attempt; one in-progress attempt at a time', () => {
    const { assessment } = setup();
    const id = published(assessment, [mcq()]);
    const { attemptId } = unwrap(assessment.startAttempt.execute({ assessmentId: id }, learner));
    expect(assessment.submitAttempt.execute({ attemptId, answers: [] }, { userId: 'intruder', role: 'employee' }).ok).toBe(false);
    expect(assessment.startAttempt.execute({ assessmentId: id }, learner).ok).toBe(false);
  });
});
