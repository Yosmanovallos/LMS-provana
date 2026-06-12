import Link from 'next/link';
import { api } from '@/lib/api';
import { CatalogView, EnrollmentView } from '@/lib/types';
import { Card, EmptyState, PageHeader, StatusPill } from '@/components/ui';
import { enrollAction } from '../learning-actions';

export default async function CatalogPage() {
  const [catalog, enrollments] = await Promise.all([
    api<CatalogView>('/catalog'),
    api<EnrollmentView[]>('/my-learning/enrollments'),
  ]);
  const enrolledIds = new Set(enrollments.map((e) => e.targetId));

  const EnrollButton = ({ kind, id }: { kind: string; id: string }) =>
    enrolledIds.has(id) ? (
      <span className="font-ledger text-[11px] uppercase tracking-wider text-verdict-ok">Enrolled ✓</span>
    ) : (
      <form action={enrollAction.bind(null, kind, id)}>
        <button type="submit" className="btn-quiet !py-1 text-xs">
          Enroll
        </button>
      </form>
    );

  return (
    <>
      <PageHeader kicker="Catalog" title="Published catalog" />
      <div className="space-y-6">
        <Card title={`Study paths — ${catalog.paths.length}`}>
          {catalog.paths.length === 0 ? (
            <EmptyState>No published paths.</EmptyState>
          ) : (
            <ul>
              {catalog.paths.map((p) => (
                <li key={p.id} className="ledger-row">
                  <div>
                    <p className="text-sm font-semibold">{p.title}</p>
                    <p className="font-ledger text-[11px] text-ink-faint">
                      {p.items.length} items
                      {p.targetRoleLevel ? ` · targets ${p.targetRoleLevel.jobRoleId}/${p.targetRoleLevel.jobLevelId}` : ''}
                    </p>
                  </div>
                  <EnrollButton kind="path" id={p.id} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title={`Courses — ${catalog.courses.length}`}>
          {catalog.courses.length === 0 ? (
            <EmptyState>No published courses.</EmptyState>
          ) : (
            <ul>
              {catalog.courses.map((c) => (
                <li key={c.id} className="ledger-row">
                  <div>
                    <Link href={`/courses/${c.id}`} className="text-sm font-semibold hover:text-pine-deep hover:underline">
                      {c.title}
                    </Link>
                    <p className="font-ledger text-[11px] text-ink-faint">
                      {c.modules.reduce((n, m) => n + m.lessons.length, 0)} lessons · v{c.version}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusPill status={c.status} />
                    <EnrollButton kind="course" id={c.id} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title={`Programs — ${catalog.programs.length}`}>
          {catalog.programs.length === 0 ? (
            <EmptyState>No programs.</EmptyState>
          ) : (
            <ul>
              {catalog.programs.map((p) => (
                <li key={p.id} className="ledger-row">
                  <div>
                    <p className="text-sm font-semibold">{p.title}</p>
                    <p className="font-ledger text-[11px] text-ink-faint">{p.courseIds.length} courses</p>
                  </div>
                  <EnrollButton kind="program" id={p.id} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
