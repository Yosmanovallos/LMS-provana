import { api, nameMap, nameOf } from '@/lib/api';
import { AnalyticsViews } from '@/lib/types';
import { Card, EmptyState, PageHeader, Stat, Table, Td } from '@/components/ui';

export default async function AnalyticsPage() {
  const [completionRate, velocity, activeLearners, teamProgress, readiness, names] = await Promise.all([
    api<AnalyticsViews['completionRate']>('/analytics/completion-rate'),
    api<AnalyticsViews['velocity']>('/analytics/velocity'),
    api<AnalyticsViews['activeLearners']>('/analytics/active-learners'),
    api<AnalyticsViews['teamProgress']>('/analytics/team-progress'),
    api<AnalyticsViews['readinessDistribution']>('/analytics/readiness-distribution'),
    nameMap(),
  ]);

  const latestActive = activeLearners[activeLearners.length - 1];
  const latestVelocity = velocity[velocity.length - 1];
  const maxBucket = Math.max(1, ...readiness.map((b) => b.count));

  return (
    <>
      <PageHeader kicker="Analytics · projections rebuilt from the event log" title="Learning analytics" />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat
          label="Active learners"
          value={<span className="font-ledger">{latestActive?.count ?? 0}</span>}
          hint={latestActive ? `week ${latestActive.week}` : 'no activity yet'}
        />
        <Stat
          label="Completions"
          value={<span className="font-ledger">{latestVelocity?.completions ?? 0}</span>}
          hint={latestVelocity ? `week ${latestVelocity.week}` : 'no completions yet'}
        />
        <Stat
          label="Teams tracked"
          value={<span className="font-ledger">{completionRate.length}</span>}
        />
      </div>

      <div className="space-y-6">
        <Card title="Readiness distribution">
          {readiness.length === 0 ? (
            <EmptyState>No readiness snapshots yet.</EmptyState>
          ) : (
            <ul className="space-y-2">
              {readiness.map((b) => (
                <li key={b.bucket} className="flex items-center gap-3">
                  <span className="w-20 font-ledger text-xs text-ink-soft">{b.bucket}</span>
                  <div className="h-4 flex-1 rounded-ledger bg-paper-sunken">
                    <div className="h-4 rounded-ledger bg-ember" style={{ width: `${(b.count / maxBucket) * 100}%` }} />
                  </div>
                  <span className="w-8 text-right font-ledger text-xs">{b.count}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="My team's progress">
          {teamProgress.length === 0 ? (
            <EmptyState>No enrollments in your team yet.</EmptyState>
          ) : (
            <Table head={['Person', 'Enrolled', 'Completed']}>
              {teamProgress.map((r) => (
                <tr key={r.userId}>
                  <Td className="font-semibold">{nameOf(names, r.userId)}</Td>
                  <Td className="font-ledger">{r.enrolled}</Td>
                  <Td className="font-ledger">{r.completed}</Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>

        <Card title="Completion rate by team">
          {completionRate.length === 0 ? (
            <EmptyState>No data.</EmptyState>
          ) : (
            <Table head={['Manager', 'Enrolled', 'Completed', 'Rate']}>
              {completionRate.map((r) => (
                <tr key={r.managerId}>
                  <Td className="font-semibold">{nameOf(names, r.managerId)}</Td>
                  <Td className="font-ledger">{r.enrolled}</Td>
                  <Td className="font-ledger">{r.completed}</Td>
                  <Td className="font-ledger">{r.ratePct}%</Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>

        <Card title="Learning velocity (completions per week)">
          {velocity.length === 0 ? (
            <EmptyState>No completions yet.</EmptyState>
          ) : (
            <Table head={['Week', 'Completions']}>
              {velocity.map((w) => (
                <tr key={w.week}>
                  <Td className="font-ledger">{w.week}</Td>
                  <Td className="font-ledger">{w.completions}</Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      </div>
    </>
  );
}
