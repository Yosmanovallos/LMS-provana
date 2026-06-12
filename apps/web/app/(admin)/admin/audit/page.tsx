import { api } from '@/lib/api';
import { DomainEventRecord } from '@/lib/types';
import { Card, EmptyState, PageHeader, Table, Td } from '@/components/ui';

export default async function AuditPage() {
  const events = await api<DomainEventRecord[]>('/notifications/audit/events');
  const newestFirst = [...events].reverse();

  return (
    <>
      <PageHeader kicker="Admin · append-only domain event log" title={`Audit — last ${newestFirst.length} events`} />
      {newestFirst.length === 0 ? (
        <EmptyState>No events recorded.</EmptyState>
      ) : (
        <Card>
          <Table head={['When', 'Type', 'Context', 'Aggregate', 'Payload']}>
            {newestFirst.map((e) => (
              <tr key={e.id}>
                <Td className="whitespace-nowrap font-ledger text-xs text-ink-faint">
                  {new Date(e.occurredAt).toLocaleString()}
                </Td>
                <Td className="font-semibold">{e.type}</Td>
                <Td className="font-ledger text-xs">{e.context}</Td>
                <Td className="max-w-32 truncate font-ledger text-xs text-ink-faint">{e.aggregateId}</Td>
                <Td>
                  <details>
                    <summary className="cursor-pointer font-ledger text-xs text-pine">view</summary>
                    <pre className="mt-1 max-w-md overflow-x-auto rounded-ledger bg-paper-sunken p-2 font-ledger text-[11px]">
                      {JSON.stringify(e.payload, null, 1)}
                    </pre>
                  </details>
                </Td>
              </tr>
            ))}
          </Table>
        </Card>
      )}
    </>
  );
}
