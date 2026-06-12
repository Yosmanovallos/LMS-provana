import { api } from '@/lib/api';
import { InAppNotification } from '@/lib/types';
import { EmptyState, PageHeader } from '@/components/ui';
import { markReadAction } from './actions';

export default async function NotificationsPage() {
  const inbox = await api<InAppNotification[]>('/notifications');
  const unread = inbox.filter((n) => !n.readAt).length;

  return (
    <>
      <PageHeader kicker={`Inbox · ${unread} unread`} title="Notifications" />
      {inbox.length === 0 ? (
        <EmptyState>Nothing here yet.</EmptyState>
      ) : (
        <ul className="space-y-3">
          {inbox.map((n) => (
            <li
              key={n.id}
              className={`ledger-card flex items-start justify-between gap-4 px-5 py-4 ${
                n.readAt ? 'opacity-60' : 'border-l-2 border-l-ember'
              }`}
            >
              <div>
                <p className="text-sm font-semibold">{n.title}</p>
                <p className="mt-0.5 text-sm text-ink-soft">{n.body}</p>
                <p className="mt-1 font-ledger text-[11px] text-ink-faint">
                  {new Date(n.createdAt).toLocaleString()}
                </p>
              </div>
              {!n.readAt ? (
                <form action={markReadAction.bind(null, n.id)}>
                  <button type="submit" className="btn-quiet !py-0.5 text-xs">
                    Mark read
                  </button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
