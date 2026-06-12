import { api, nameMap, nameOf } from '@/lib/api';
import { AssessmentView, AttemptView } from '@/lib/types';
import { Card, EmptyState, PageHeader } from '@/components/ui';
import { reviewAttemptAction } from '../actions';

export default async function AssessmentQueuePage() {
  const [queue, names] = await Promise.all([api<AttemptView[]>('/review-queue/assessments'), nameMap()]);
  const assessments = new Map<string, AssessmentView>();
  for (const id of new Set(queue.map((a) => a.assessmentId))) {
    const assessment = await api<AssessmentView | null>(`/assessments/${id}`);
    if (assessment) assessments.set(id, assessment);
  }

  return (
    <>
      <PageHeader kicker="Review queue" title={`Assessments — ${queue.length} awaiting review`} />
      {queue.length === 0 ? (
        <EmptyState>No attempts awaiting review.</EmptyState>
      ) : (
        <div className="space-y-5">
          {queue.map((attempt) => {
            const assessment = assessments.get(attempt.assessmentId);
            const manualQuestions = (assessment?.questions ?? []).filter((q) => q.kind !== 'multiple-choice');
            const answerOf = (questionId: string) => {
              const answer = attempt.answers.find((a) => a.questionId === questionId);
              return typeof answer?.value === 'string' ? answer.value : '—';
            };
            return (
              <Card key={attempt.attemptId} title={`${attempt.assessmentTitle} · ${nameOf(names, attempt.userId)}`}>
                <form action={reviewAttemptAction.bind(null, attempt.attemptId)} className="space-y-4">
                  {manualQuestions.map((q) => (
                    <div key={q.id} className="rounded-ledger border border-ink-line p-4">
                      <p className="text-sm font-semibold">{q.prompt}</p>
                      <p className="mt-2 border-l-2 border-ink-line pl-3 text-sm text-ink-soft">
                        {answerOf(q.id) || <span className="text-ink-faint">No answer given</span>}
                      </p>
                      <label className="mt-3 flex items-center gap-2 text-sm">
                        <span className="kicker">Points (0–{q.points})</span>
                        <input
                          type="number"
                          name={`score:${q.id}`}
                          min={0}
                          max={q.points}
                          defaultValue={0}
                          required
                          className="field !w-24"
                        />
                      </label>
                    </div>
                  ))}
                  <textarea
                    name="feedback"
                    rows={2}
                    className="field"
                    placeholder="Feedback (required when the attempt fails)"
                  />
                  <div className="flex justify-end">
                    <button type="submit" className="btn-primary">
                      Finalize review
                    </button>
                  </div>
                </form>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
