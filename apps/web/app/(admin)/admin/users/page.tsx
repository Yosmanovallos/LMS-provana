import { api } from '@/lib/api';
import { ProfileView, Taxonomy, UserView } from '@/lib/types';
import { Card, PageHeader } from '@/components/ui';
import { assignManagerAction, assignRoleAction, changeJobLevelAction, registerUserAction } from './actions';

export default async function UsersPage() {
  const [users, taxonomy] = await Promise.all([api<UserView[]>('/users'), api<Taxonomy>('/org/taxonomy')]);
  const profiles = new Map<string, ProfileView | null>(
    await Promise.all(
      users.map(async (u) => [u.id, await api<ProfileView | null>(`/org/profiles/${u.id}`)] as const),
    ),
  );
  const managers = users.filter((u) => u.role === 'manager' || u.role === 'admin');

  return (
    <>
      <PageHeader kicker="Admin" title={`Users — ${users.length}`} />

      <div className="space-y-4">
        {users.map((u) => {
          const profile = profiles.get(u.id) ?? null;
          return (
            <Card key={u.id}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <p className="font-display text-base">{u.displayName}</p>
                  <p className="font-ledger text-[11px] text-ink-faint">{u.email}</p>
                </div>
                <p className="font-ledger text-[11px] uppercase tracking-wider text-ember">{u.role}</p>
              </div>

              <div className="mt-4 grid gap-4 border-t border-dotted border-ink-line pt-4 lg:grid-cols-3">
                <form action={assignRoleAction.bind(null, u.id)} className="flex items-end gap-2">
                  <label className="flex-1 text-sm">
                    <span className="kicker mb-1 block">Platform role</span>
                    <select name="role" defaultValue={u.role} className="field">
                      <option value="employee">employee</option>
                      <option value="manager">manager</option>
                      <option value="admin">admin</option>
                    </select>
                  </label>
                  <button type="submit" className="btn-quiet !py-1.5 text-xs">
                    Set
                  </button>
                </form>

                <form action={assignManagerAction.bind(null, u.id)} className="flex items-end gap-2">
                  <label className="flex-1 text-sm">
                    <span className="kicker mb-1 block">Manager</span>
                    <select name="managerId" defaultValue={profile?.managerId ?? ''} className="field">
                      <option value="" disabled>
                        choose…
                      </option>
                      {managers
                        .filter((m) => m.id !== u.id)
                        .map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.displayName}
                          </option>
                        ))}
                    </select>
                  </label>
                  <button type="submit" className="btn-quiet !py-1.5 text-xs">
                    Set
                  </button>
                </form>

                <form action={changeJobLevelAction.bind(null, u.id)} className="flex items-end gap-2">
                  <label className="text-sm">
                    <span className="kicker mb-1 block">Job role</span>
                    <select name="jobRoleId" defaultValue={profile?.jobRoleId ?? ''} className="field" required>
                      <option value="" disabled>
                        role…
                      </option>
                      {taxonomy.roles.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm">
                    <span className="kicker mb-1 block">Level</span>
                    <select name="jobLevelId" defaultValue={profile?.jobLevelId ?? ''} className="field" required>
                      <option value="" disabled>
                        level…
                      </option>
                      {taxonomy.levels.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button type="submit" className="btn-quiet !py-1.5 text-xs">
                    Set
                  </button>
                </form>
              </div>
            </Card>
          );
        })}

        <Card title="Register user">
          <form action={registerUserAction} className="grid gap-3 sm:grid-cols-4">
            <input name="displayName" required placeholder="Display name" className="field" />
            <input name="email" type="email" required placeholder="email@provana.dev" className="field" />
            <select name="role" defaultValue="employee" className="field">
              <option value="employee">employee</option>
              <option value="manager">manager</option>
              <option value="admin">admin</option>
            </select>
            <button type="submit" className="btn-primary justify-center">
              Register
            </button>
          </form>
        </Card>
      </div>
    </>
  );
}
