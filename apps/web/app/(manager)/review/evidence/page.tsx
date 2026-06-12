import { api, nameMap, nameOf } from '@/lib/api';
import { EvidenceView } from '@/lib/types';
import { Card, EmptyState, PageHeader, StatusPill } from '@/components/ui';
import { approveEvidenceAction, rejectEvidenceAction, startEvidenceReviewAction } from '../actions';

export default async function EvidenceQueuePage() {
  const [queue, names] = await Promise.all([api<EvidenceView[]>('/evidence/review-queue'), nameMap()]);

  return (
    <>
      <PageHeader kicker="Review queue" title={`Evidence — ${queue.length} pending`} />
      {queue.length === 0 ? (
        <EmptyState>Queue is clear. Approvals land in the promotion ledger automatically.</EmptyState>
      ) : (
        <div className="space-y-5">
          {queue.map((e) => (
            <Card key={e.evidenceId}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-display text-base">{nameOf(names, e.userId)}</p>
                  <p className="mt-1 text-sm">{e.description}</p>
                  <p className="mt-1 font-ledger text-[11px] text-ink-faint">
                    {e.file.mime} · {(e.file.sizeBytes / 1024).toFixed(0)} KB
                    {e.targetRequirementId ? ` · target: ${e.targetRequirementId}` : ''}
                    {e.resubmissionOf ? ' · resubmission' : ''}
                  </p>
                </div>
                <StatusPill status={e.status} />
              </div>

              {e.status === 'submitted' ? (
                <form action={startEvidenceReviewAction.bind(null, e.evidenceId)} className="mt-4">
                  <button type="submit" className="btn-primary">
                    Start review
                  </button>
                </form>
              ) : (
                <div className="mt-4 grid gap-3 border-t border-dotted border-ink-line pt-4 sm:grid-cols-2">
                  <form action={approveEvidenceAction.bind(null, e.evidenceId)} className="space-y-2">
                    <input name="note" className="field" placeholder="Approval note (optional)" />
                    <button type="submit" className="btn-primary w-full justify-center">
                      Approve
                    </button>
                  </form>
                  <form action={rejectEvidenceAction.bind(null, e.evidenceId)} className="space-y-2">
                    <input name="feedback" required className="field" placeholder="Rejection feedback (required)" />
                    <button type="submit" className="btn-danger w-full justify-center">
                      Reject
                    </button>
                  </form>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
