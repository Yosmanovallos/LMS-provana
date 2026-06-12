import { api } from '@/lib/api';
import { EvidenceView } from '@/lib/types';
import { Card, EmptyState, PageHeader, StatusPill } from '@/components/ui';
import { submitEvidenceAction } from './actions';

export default async function EvidencePage() {
  const items = await api<EvidenceView[]>('/evidence/mine');

  return (
    <>
      <PageHeader kicker="Evidence" title="Evidence locker" />

      <div className="space-y-6">
        <Card title="Submit new evidence">
          <form action={submitEvidenceAction} className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm sm:col-span-2">
              <span className="kicker mb-1 block">File</span>
              <input type="file" name="file" required className="field !py-2 file:mr-3 file:rounded-ledger file:border-0 file:bg-pine file:px-3 file:py-1 file:text-xs file:text-paper-raised" />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="kicker mb-1 block">What does this prove?</span>
              <textarea name="description" rows={3} required className="field" placeholder="E2E automation project for the billing squad…" />
            </label>
            <label className="text-sm">
              <span className="kicker mb-1 block">Target requirement key (optional)</span>
              <input name="targetRequirementId" className="field" placeholder="req-project-evidence" />
            </label>
            <div className="flex items-end justify-end">
              <button type="submit" className="btn-primary">
                Submit for review
              </button>
            </div>
          </form>
        </Card>

        <Card title={`My submissions — ${items.length}`}>
          {items.length === 0 ? (
            <EmptyState>Nothing submitted yet.</EmptyState>
          ) : (
            <ul className="space-y-3">
              {items.map((e) => (
                <li key={e.evidenceId} className="rounded-ledger border border-ink-line p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{e.description}</p>
                      <p className="mt-0.5 font-ledger text-[11px] text-ink-faint">
                        {e.file.mime} · {(e.file.sizeBytes / 1024).toFixed(0)} KB
                        {e.targetRequirementId ? ` · target: ${e.targetRequirementId}` : ''}
                        {e.resubmissionOf ? ' · resubmission' : ''}
                      </p>
                    </div>
                    <StatusPill status={e.status} />
                  </div>
                  {e.feedback ? (
                    <p className="mt-2 border-l-2 border-ember pl-3 text-sm text-ink-soft">“{e.feedback}”</p>
                  ) : null}
                  <p className="mt-2 font-ledger text-[11px] text-ink-faint">
                    {e.history.length} transition{e.history.length === 1 ? '' : 's'}
                    {e.decidedAt ? ` · decided ${new Date(e.decidedAt).toLocaleString()}` : ''}
                  </p>
                  {e.status === 'rejected' ? (
                    <details className="mt-3 border-t border-dotted border-ink-line pt-3">
                      <summary className="cursor-pointer text-xs text-pine underline decoration-dotted">
                        Resubmit with fixes
                      </summary>
                      <form action={submitEvidenceAction} className="mt-3 grid gap-2">
                        <input type="hidden" name="resubmissionOf" value={e.evidenceId} />
                        <input type="hidden" name="targetRequirementId" value={e.targetRequirementId ?? ''} />
                        <input type="file" name="file" required className="field !py-2 text-xs" />
                        <textarea
                          name="description"
                          rows={2}
                          required
                          defaultValue={e.description}
                          className="field"
                        />
                        <div className="flex justify-end">
                          <button type="submit" className="btn-primary !py-1 text-xs">
                            Resubmit
                          </button>
                        </div>
                      </form>
                    </details>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
