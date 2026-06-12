import Link from 'next/link';
import { api } from '@/lib/api';
import { CertificationView, EnrollmentView, MyLearningView } from '@/lib/types';
import { EmptyState, PageHeader, Progress, StatusPill, Tabs } from '@/components/ui';

const TAB_KEYS = ['todo', 'active', 'history', 'certificates'] as const;
type TabKey = (typeof TAB_KEYS)[number];

function EnrollmentCard({ e }: { e: EnrollmentView }) {
  const title =
    e.targetKind === 'course' ? (
      <Link href={`/courses/${e.targetId}`} className="hover:text-pine-deep hover:underline">
        {e.title}
      </Link>
    ) : (
      e.title
    );
  return (
    <li className="ledger-card flex flex-wrap items-center justify-between gap-4 px-5 py-4">
      <div className="min-w-48">
        <p className="font-display text-base">{title}</p>
        <p className="mt-0.5 font-ledger text-[11px] uppercase tracking-wider text-ink-faint">
          {e.targetKind} · {e.source}
          {e.dueDate ? ` · due ${new Date(e.dueDate).toLocaleDateString()}` : ''}
        </p>
      </div>
      <div className="flex items-center gap-4">
        <div className="w-40">
          <Progress pct={e.percentComplete} />
        </div>
        <StatusPill status={e.status} />
      </div>
    </li>
  );
}

export default async function MyLearningPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab: rawTab } = await searchParams;
  const tab: TabKey = TAB_KEYS.includes(rawTab as TabKey) ? (rawTab as TabKey) : 'todo';

  const [learning, certs] = await Promise.all([
    api<MyLearningView>('/my-learning'),
    api<CertificationView[]>('/certifications/mine'),
  ]);

  const buckets: Record<Exclude<TabKey, 'certificates'>, EnrollmentView[]> = {
    todo: learning.todo,
    active: learning.active,
    history: learning.completed,
  };

  return (
    <>
      <PageHeader kicker="My Learning" title="Learning hub" />
      <Tabs
        current={tab}
        hrefFor={(k) => `/my-learning?tab=${k}`}
        tabs={[
          { key: 'todo', label: 'To Do', count: learning.todo.length },
          { key: 'active', label: 'Active', count: learning.active.length },
          { key: 'history', label: 'History', count: learning.completed.length },
          { key: 'certificates', label: 'Certificates', count: certs.length },
        ]}
      />

      {tab === 'certificates' ? (
        certs.length === 0 ? (
          <EmptyState>No certificates yet — complete courses and pass assessments to earn them.</EmptyState>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {certs.map((c) => (
              <li key={c.certificationId} className="ledger-card px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-display text-base">{c.name}</p>
                  <StatusPill status={c.status} />
                </div>
                <p className="mt-1 font-ledger text-[11px] uppercase tracking-wider text-ink-faint">
                  {c.source} · issued {new Date(c.issuedAt).toLocaleDateString()}
                  {c.expiresAt ? ` · expires ${new Date(c.expiresAt).toLocaleDateString()}` : ''}
                </p>
              </li>
            ))}
          </ul>
        )
      ) : buckets[tab].length === 0 ? (
        <EmptyState>
          Nothing here. Browse the <Link href="/catalog" className="underline">catalog</Link> to enroll.
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {buckets[tab].map((e) => (
            <EnrollmentCard key={e.enrollmentId} e={e} />
          ))}
        </ul>
      )}
    </>
  );
}
