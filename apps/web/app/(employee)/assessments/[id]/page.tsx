import { api } from '@/lib/api';
import { AssessmentView } from '@/lib/types';
import { Card, PageHeader } from '@/components/ui';
import { takeAssessmentAction } from '../actions';

export default async function TakeAssessmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const assessment = await api<AssessmentView | null>(`/assessments/${id}`);
  if (!assessment) {
    return <PageHeader kicker="Assessment" title="Assessment not found" />;
  }

  return (
    <>
      <PageHeader
        kicker={`Assessment · pass ≥ ${assessment.passingScorePct}%`}
        title={assessment.title}
      />
      <form action={takeAssessmentAction.bind(null, assessment.id)} className="space-y-5">
        {assessment.questions.map((q, i) => (
          <Card key={q.id} title={`Question ${i + 1} · ${q.kind} · ${q.points} pts`}>
            <p className="mb-4 text-sm font-semibold">{q.prompt}</p>
            {q.kind === 'multiple-choice' ? (
              <ul className="space-y-2">
                {q.options.map((option, idx) => (
                  <li key={idx}>
                    <label className="flex cursor-pointer items-center gap-3 rounded-ledger border border-ink-line px-3 py-2 text-sm hover:border-pine">
                      <input type="checkbox" name={`q:${q.id}`} value={idx} className="accent-pine" />
                      {option}
                    </label>
                  </li>
                ))}
                <li className="pt-1 font-ledger text-[11px] text-ink-faint">
                  Select every option that applies — scoring is exact-match.
                </li>
              </ul>
            ) : (
              <textarea
                name={`q:${q.id}`}
                rows={4}
                required
                placeholder={q.kind === 'practical' ? 'Describe your work and link the artifact (repo, doc…)' : 'Your answer'}
                className="field"
              />
            )}
          </Card>
        ))}
        <div className="flex justify-end">
          <button type="submit" className="btn-primary">
            Submit attempt
          </button>
        </div>
      </form>
    </>
  );
}
