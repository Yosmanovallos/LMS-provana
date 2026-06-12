import { AuthenticatedUser } from '../../../ports/auth.port';
import { IdPort } from '../../../ports/system.port';
import { Result, err, ok } from '../../shared-kernel/result';
import { Assessment, Question } from '../domain/assessment';
import { AssessmentRepository } from '../assessment.repositories';

export type QuestionInput =
  | { kind: 'multiple-choice'; prompt: string; options: string[]; correctIndexes: number[]; points: number }
  | { kind: 'open-text'; prompt: string; points: number }
  | { kind: 'practical'; prompt: string; points: number };

export class AuthorAssessmentHandler {
  constructor(
    private readonly assessments: AssessmentRepository,
    private readonly ids: IdPort,
  ) {}

  create(
    input: { title: string; questions: QuestionInput[]; passingScorePct: number; maxAttempts: number },
    actor: AuthenticatedUser,
  ): Result<{ assessmentId: string }> {
    if (actor.role !== 'admin') return err('forbidden', 'assessment.manage requires admin');
    for (const q of input.questions) {
      if (q.points <= 0) return err('validation', 'Question points must be positive');
      if (q.kind === 'multiple-choice') {
        if (q.correctIndexes.length === 0) return err('validation', 'MC question needs correct answers');
        if (q.correctIndexes.some((i) => i < 0 || i >= q.options.length)) {
          return err('validation', 'correctIndexes out of options range');
        }
      }
    }
    const questions: Question[] = input.questions.map((q) => ({ id: this.ids.next(), ...q }));
    const assessment = new Assessment(
      this.ids.next(),
      input.title,
      questions,
      input.passingScorePct,
      input.maxAttempts,
    );
    this.assessments.save(assessment);
    return ok({ assessmentId: assessment.id });
  }

  publish(assessmentId: string, actor: AuthenticatedUser): Result<void> {
    if (actor.role !== 'admin') return err('forbidden', 'assessment.manage requires admin');
    const assessment = this.assessments.byId(assessmentId);
    if (!assessment) return err('not-found', `Assessment not found: ${assessmentId}`);
    const result = assessment.publish();
    if (!result.ok) return result;
    this.assessments.save(assessment);
    return ok(undefined);
  }
}
