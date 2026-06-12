import { api } from '@/lib/api';
import { CatalogView, Taxonomy } from '@/lib/types';
import { Card, EmptyState, PageHeader, StatusPill } from '@/components/ui';
import { createCourseAction, createPathAction, publishCourseAction, publishPathAction } from './actions';

export default async function CatalogBuilderPage() {
  const [catalog, taxonomy] = await Promise.all([api<CatalogView>('/catalog'), api<Taxonomy>('/org/taxonomy')]);

  return (
    <>
      <PageHeader kicker="Admin · drafts publish with versioning" title="Catalog builder" />

      <div className="space-y-6">
        <Card title={`Courses — ${catalog.courses.length}`}>
          {catalog.courses.length === 0 ? (
            <EmptyState>No courses yet.</EmptyState>
          ) : (
            <ul>
              {catalog.courses.map((c) => (
                <li key={c.id} className="ledger-row items-center">
                  <div>
                    <p className="text-sm font-semibold">{c.title}</p>
                    <p className="font-ledger text-[11px] text-ink-faint">
                      {c.modules.reduce((n, m) => n + m.lessons.length, 0)} lessons · v{c.version} ·{' '}
                      <span className="select-all">{c.id}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusPill status={c.status} />
                    {c.status === 'draft' ? (
                      <form action={publishCourseAction.bind(null, c.id)}>
                        <button type="submit" className="btn-primary !py-1 text-xs">
                          Publish
                        </button>
                      </form>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <form action={createCourseAction} className="mt-5 grid gap-3 border-t border-dotted border-ink-line pt-5">
            <p className="kicker">New course</p>
            <input name="title" required placeholder="Course title" className="field" />
            <textarea
              name="lessons"
              required
              rows={3}
              placeholder={'One lesson title per line:\nIntro\nDeep dive\nWrap-up'}
              className="field font-ledger text-xs"
            />
            <div className="flex justify-end">
              <button type="submit" className="btn-quiet">
                Create draft
              </button>
            </div>
          </form>
        </Card>

        <Card title={`Study paths — ${catalog.paths.length}`}>
          {catalog.paths.length === 0 ? (
            <EmptyState>No paths yet.</EmptyState>
          ) : (
            <ul>
              {catalog.paths.map((p) => (
                <li key={p.id} className="ledger-row items-center">
                  <div>
                    <p className="text-sm font-semibold">{p.title}</p>
                    <p className="font-ledger text-[11px] text-ink-faint">
                      {p.items.length} items
                      {p.targetRoleLevel ? ` · targets ${p.targetRoleLevel.jobRoleId}/${p.targetRoleLevel.jobLevelId}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusPill status={p.status} />
                    {p.status === 'draft' ? (
                      <form action={publishPathAction.bind(null, p.id)}>
                        <button type="submit" className="btn-primary !py-1 text-xs">
                          Publish
                        </button>
                      </form>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <form action={createPathAction} className="mt-5 grid gap-3 border-t border-dotted border-ink-line pt-5">
            <p className="kicker">New study path</p>
            <input name="title" required placeholder="Path title" className="field" />
            <div className="grid grid-cols-2 gap-3">
              <select name="jobRoleId" className="field" defaultValue="">
                <option value="">Target role (optional)</option>
                {taxonomy.roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
              <select name="jobLevelId" className="field" defaultValue="">
                <option value="">Target level (optional)</option>
                {taxonomy.levels.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
            <textarea
              name="items"
              required
              rows={3}
              placeholder='[{"kind":"course","refId":"<course-id>"},{"kind":"assessment","refId":"<assessment-id>"}]'
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
