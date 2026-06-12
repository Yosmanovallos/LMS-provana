import Link from 'next/link';
import { api, nameMap, nameOf } from '@/lib/api';
import { TeamReadinessRow } from '@/lib/types';
import { Card, EmptyState, PageHeader, Progress, Table, Td } from '@/components/ui';

export default async function TeamReadinessPage() {
  const [rows, names] = await Promise.all([api<TeamReadinessRow[]>('/promotion/team'), nameMap()]);

  return (
    <>
      <PageHeader kicker="Promotion engine" title="Team readiness" />
      {rows.length === 0 ? (
        <EmptyState>No team members.</EmptyState>
      ) : (
        <Card>
          <Table head={['Person', 'Target', 'Readiness', 'Open items', '']}>
            {rows.map((r) => (
              <tr key={r.userId}>
                <Td className="font-semibold">{nameOf(names, r.userId)}</Td>
                <Td>
                  {r.targetRoleLevel ? (
                    <span className="font-ledger text-xs uppercase tracking-wider">
                      {r.targetRoleLevel.jobRoleId} · {r.targetRoleLevel.jobLevelId}
                    </span>
                  ) : (
                    <span className="text-ink-faint">no active set</span>
                  )}
                </Td>
                <Td className="w-56">
                  {r.percentReady === null ? (
                    <span className="text-ink-faint">—</span>
                  ) : (
                    <Progress pct={r.percentReady} tone={r.percentReady >= 100 ? 'pine' : 'ember'} />
                  )}
                </Td>
                <Td className="font-ledger">{r.pendingItems ?? '—'}</Td>
                <Td>
                  <Link href={`/readiness/${r.userId}`} className="text-xs text-pine underline decoration-dotted hover:text-pine-deep">
                    Gap report
                  </Link>
                </Td>
              </tr>
            ))}
          </Table>
        </Card>
      )}
    </>
  );
}
