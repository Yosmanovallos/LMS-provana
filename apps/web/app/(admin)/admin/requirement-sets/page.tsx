import { api } from '@/lib/api';
import { RequirementSetView, Taxonomy } from '@/lib/types';
import { Card, EmptyState, PageHeader, StatusPill } from '@/components/ui';
import { activateSetAction, createRequirementSetAction, newVersionAction } from './actions';

const exampleRequirements = `[
  {"kind":"course","courseId":"<course-id>","label":"Testing Fundamentals","weight":10},
  {"kind":"assessment","assessmentId":"<assessment-id>","label":"Theory","weight":30},
  {"kind":"certification","certificationName":"Certification B","label":"Cert B","weight":4},
  {"kind":"evidence","requirementKey":"req-project-evidence","label":"Project Evidence","weight":32},
  {"kind":"tenure","months":12,"label":"12 months at level","weight":24}
]`;

export default async function RequirementSetsPage() {
  const [sets, taxonomy] = await Promise.all([
    api<RequirementSetView[]>('/requirement-sets'),
    api<Taxonomy>('/org/taxonomy'),
  ]);

  const RoleLevelSelects = ({ prefix }: { prefix: 'from' | 'to' }) => (
    <div className="grid grid-cols-2 gap-3">
      <select name={`${prefix}Role`} required className="field" defaultValue="">
        <option value="" disabled>
          {prefix === 'from' ? 'From role' : 'To role'}
        </option>
        {taxonomy.roles.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>
      <select name={`${prefix}Level`} required className="field" defaultValue="">
        <option value="" disabled>
          {prefix === 'from' ? 'From level' : 'To level'}
        </option>
        {taxonomy.levels.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <>
      <PageHeader kicker="Admin · versioned data, not code" title="Requirement sets" />

      <div className="space-y-6">
        {sets.length === 0 ? (
          <EmptyState>No requirement sets defined.</EmptyState>
        ) : (
          sets.map((s) => (
            <Card
              key={s.id}
              title={`${s.fromRoleLevel.jobRoleId}/${s.fromRoleLevel.jobLevelId} → ${s.toRoleLevel.jobRoleId}/${s.toRoleLevel.jobLevelId} · v${s.version}`}
            >
              <div className="mb-3 flex items-center gap-3">
                <StatusPill status={s.status} />
                <span className="font-ledger text-[11px] text-ink-faint">
                  total weight {s.requirements.reduce((n, r) => n + r.weight, 0)}
                </span>
              </div>
              <ul>
                {s.requirements.map((r) => (
                  <li key={r.id} className="ledger-row">
                    <span className="text-sm">
                      <span className="mr-2 font-ledger text-xs uppercase text-ink-faint">{r.kind}</span>
                      {r.label}
                    </span>
                    <span className="font-ledger text-xs text-ink-faint">{r.weight} pts</span>
                  </li>
                ))}
              </ul>

              <div className="mt-4 flex flex-wrap items-start gap-3 border-t border-dotted border-ink-line pt-4">
                {s.status === 'draft' ? (
                  <form action={activateSetAction.bind(null, s.id)}>
                    <button type="submit" className="btn-primary !py-1 text-xs">
                      Activate
                    </button>
                  </form>
                ) : null}
                {s.status === 'active' ? (
                  <details className="w-full">
                    <summary className="cursor-pointer text-xs text-ink-soft underline decoration-dotted">
                      New version (supersedes v{s.version}; old snapshots keep their version)
                    </summary>
                    <form action={newVersionAction.bind(null, s.id)} className="mt-3 grid gap-3">
                      <textarea
                        name="requirements"
                        rows={5}
                        required
                        defaultValue={JSON.stringify(s.requirements.map(({ id: _id, ...r }) => r), null, 1)}
                        className="field font-ledger text-xs"
                      />
                      <div className="flex justify-end">
                        <button type="submit" className="btn-quiet !py-1 text-xs">
                          Create v{s.version + 1}
                        </button>
                      </div>
                    </form>
                  </details>
                ) : null}
              </div>
            </Card>
          ))
        )}

        <Card title="New requirement set (draft)">
          <form action={createRequirementSetAction} className="grid gap-3">
            <RoleLevelSelects prefix="from" />
            <RoleLevelSelects prefix="to" />
            <textarea
              name="requirements"
              rows={7}
              required
              placeholder={exampleRequirements}
              className="field font-ledger text-xs"
            />
            <div className="flex justify-end">
              <button type="submit" className="btn-quiet">
                Create draft
              </button>
            </div>
          </form>
        </Card>
      </div>
    </>
  );
}
