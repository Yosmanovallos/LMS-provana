import { AggregateRoot } from '../../shared-kernel/aggregate-root';
import { Result, err, ok } from '../../shared-kernel/result';

export type Question =
  | { id: string; kind: 'multiple-choice'; prompt: string; options: string[]; correctIndexes: number[]; points: number }
  | { id: string; kind: 'open-text'; prompt: string; points: number }
  | { id: string; kind: 'practical'; prompt: string; points: number };

export class Assessment extends AggregateRoot {
  status: 'draft' | 'published' = 'draft';

  constructor(
    public readonly id: string,
    public title: string,
    public questions: Question[],
    public passingScorePct: number,
    public maxAttempts: number,
  ) {
    super();
  }

  publish(): Result<void> {
    if (this.questions.length === 0) return err('validation', 'Assessment needs questions');
    if (this.passingScorePct < 0 || this.passingScorePct > 100) {
      return err('validation', 'passingScorePct must be 0-100');
    }
    if (this.maxAttempts < 1) return err('validation', 'maxAttempts must be >= 1');
    this.status = 'published';
    return ok(undefined);
  }

  totalPoints(): number {
    return this.questions.reduce((sum, q) => sum + q.points, 0);
  }

  manualQuestions(): Question[] {
    return this.questions.filter((q) => q.kind !== 'multiple-choice');
  }
}

export type AttemptStatus = 'in-progress' | 'awaiting-review' | 'passed' | 'failed';

export interface Answer {
  questionId: string;
  /** selected option indexes for MC; free text for open/practical. */
  value: number[] | string;
}

export class Attempt extends AggregateRoot {
  status: AttemptStatus = 'in-progress';
  answers: Answer[] = [];
  /** Points per question, filled by auto-scoring and review. */
  awarded = new Map<string, number>();
  scorePct: number | null = null;
  reviewerId: string | null = null;
  feedback: string | null = null;

  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly assessmentId: string,
  ) {
    super();
  }

  submit(answers: Answer[], assessment: Assessment): Result<void> {
    if (this.status !== 'in-progress') return err('invariant', 'Attempt already submitted');
    this.answers = answers;
    // auto-score multiple choice: full points on exact selected-set match
    for (const q of assessment.questions) {
      if (q.kind !== 'multiple-choice') continue;
      const answer = answers.find((a) => a.questionId === q.id);
      const selected = Array.isArray(answer?.value) ? [...answer.value].sort() : [];
      const correct = [...q.correctIndexes].sort();
      const exact = selected.length === correct.length && selected.every((v, i) => v === correct[i]);
      this.awarded.set(q.id, exact ? q.points : 0);
    }
    this.recordEvent('AttemptSubmitted', this.id, {
      attemptId: this.id,
      userId: this.userId,
      assessmentId: this.assessmentId,
    });
    if (assessment.manualQuestions().length > 0) {
      this.status = 'awaiting-review';
      return ok(undefined);
    }
    this.finalize(assessment);
    return ok(undefined);
  }

  review(
    reviewerId: string,
    manualScores: { questionId: string; points: number }[],
    feedback: string | undefined,
    assessment: Assessment,
  ): Result<void> {
    if (this.status !== 'awaiting-review') {
      return err('invariant', 'Only awaiting-review attempts can be reviewed (scores are immutable once finalized)');
    }
    for (const q of assessment.manualQuestions()) {
      const score = manualScores.find((s) => s.questionId === q.id);
      if (!score) return err('validation', `Missing review score for question ${q.id}`);
      if (score.points < 0 || score.points > q.points) {
        return err('validation', `Score for ${q.id} out of range 0-${q.points}`);
      }
      this.awarded.set(q.id, score.points);
    }
    this.reviewerId = reviewerId;
    this.feedback = feedback ?? null;
    const wouldPass = this.computePct(assessment) >= assessment.passingScorePct;
    if (!wouldPass && (!feedback || feedback.trim().length === 0)) {
      return err('validation', 'Failing review requires feedback');
    }
    this.finalize(assessment);
    return ok(undefined);
  }

  private computePct(assessment: Assessment): number {
    const total = assessment.totalPoints();
    const earned = [...this.awarded.values()].reduce((a, b) => a + b, 0);
    return total === 0 ? 0 : Math.round((earned / total) * 100);
  }

  private finalize(assessment: Assessment): void {
    this.scorePct = this.computePct(assessment);
    const passed = this.scorePct >= assessment.passingScorePct;
    this.status = passed ? 'passed' : 'failed';
    this.recordEvent(passed ? 'AssessmentPassed' : 'AssessmentFailed', this.id, {
      userId: this.userId,
      assessmentId: this.assessmentId,
      attemptId: this.id,
      scorePct: this.scorePct,
    });
  }
}
