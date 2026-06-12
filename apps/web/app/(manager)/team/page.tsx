import { api } from '@/lib/api';
import { ProfileView } from '@/lib/types';
import { Card, EmptyState, PageHeader, Table, Td } from '@/components/ui';
import { recognizeAction } from '../review/actions';

export default async function TeamPage() {
  const team = await api<ProfileView[]>('/org/team');

  return (
    <>
      <PageHeader kicker="Team" title={`My team — ${team.length}`} />
      {team.length === 0 ? (
        <EmptyState>No assigned employees. Admins assign managers under Users.</EmptyState>
      ) : (
        <Card>
          <Table head={['Person', 'Role · Level', 'At level since', 'Level changes', 'Recognize']}>
            {team.map((p) => (
              <tr key={p.userId}>
                <Td className="font-semibold">{p.displayName}</Td>
                <Td>
                  {p.jobRoleId ? (
                    <span className="font-ledger text-xs uppercase tracking-wider">
                      {p.jobRoleId} · {p.jobLevelId}
                    </span>
                  ) : (
                    <span className="text-ink-faint">unassigned</span>
                  )}
                </Td>
                <Td className="text-ink-soft">
                  {p.currentLevelSince ? new Date(p.currentLevelSince).toLocaleDateString() : '—'}
                </Td>
                <Td className="font-ledger">{p.levelHistory.length}</Td>
                <Td>
                  <form action={recognizeAction.bind(null, p.userId)}>
                    <button type="submit" className="btn-quiet !py-0.5 text-xs" title="Award recognition points">
                      ★ Recognize
                    </button>
                  </form>
                </Td>
              </tr>
            ))}
          </Table>
        </Card>
      )}
    </>
  );
}
