import Link from 'next/link';
import { api } from '@/lib/api';
import { AssessmentView, AttemptView } from '@/lib/types';
import { Card, EmptyState, PageHeader, StatusPill, Table, Td } from '@/components/ui';

export default async function AssessmentsPage({ searchParams }: { searchParams: Promise<{ submitted?: string }> }) {
  const { submitted } = await searchParams;
  const [assessments, attempts] = await Promise.all([
    api<AssessmentView[]>('/assessments'),
    api<AttemptView[]>('/my/attempts'),
  ]);
  const attemptCount = (assessmentId: string) => attempts.filter((a) => a.assessmentId === assessmentId).length;

  return (
    <>
      <PageHeader kicker="Assessments" title="Assessments" />
      {submitted ? (
        <p className="mb-6 rounded-ledger border border-pine bg-pine-wash px-4 py-2 text-sm text-pine-deep">
          Submitted. Multiple-choice answers are auto-scored; open and practical questions go to your manager for review.
        </p>
      ) : null}

      <div className="space-y-6">
        <Card title={`Available — ${assessments.length}`}>
          {assessments.length === 0 ? (
            <EmptyState>No published assessments.</EmptyState>
          ) : (
            <ul>
              {assessments.map((a) => {
                const used = attemptCount(a.id);
                const exhausted = used >= a.maxAttempts;
                return (
                  <li key={a.id} className="ledger-row items-center">
                    <div>
                      <p className="text-sm font-semibold">{a.title}</p>
                      <p className="font-ledger text-[11px] text-ink-faint">
                        {a.questions.length} questions · pass ≥ {a.passingScorePct}% · attempts {used}/{a.maxAttempts}
                      </p>
                    </div>
                    {exhausted ? (
                      <span className="font-ledger text-[11px] uppercase text-ink-faint">No attempts left</span>
                    ) : (
                      <Link href={`/assessments/${a.id}`} className="btn-primary !py-1 text-xs">
                        Take
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card title={`My attempts — ${attempts.length}`}>
          {attempts.length === 0 ? (
            <EmptyState>No attempts yet.</EmptyState>
          ) : (
            <Table head={['Assessment', 'Status', 'Score', 'Feedback']}>
              {attempts.map((a) => (
                <tr key={a.attemptId}>
                  <Td className="font-semibold">{a.assessmentTitle}</Td>
                  <Td>
                    <StatusPill status={a.status} />
                  </Td>
                  <Td className="font-ledger">{a.scorePct === null ? '—' : `${a.scorePct}%`}</Td>
                  <Td className="text-ink-soft">{a.feedback ?? '—'}</Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      </div>
    </>
  );
}
