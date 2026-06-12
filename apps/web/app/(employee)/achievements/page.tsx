import { api, nameMap, nameOf } from '@/lib/api';
import { getPersona } from '@/lib/persona';
import { AchievementView, LeaderboardEntry, PointsView } from '@/lib/types';
import { Card, EmptyState, PageHeader, Stat, Table, Tabs, Td } from '@/components/ui';

const PERIODS = ['weekly', 'monthly', 'quarterly', 'annual'] as const;

export default async function AchievementsPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const { period: raw } = await searchParams;
  const period = PERIODS.includes(raw as (typeof PERIODS)[number]) ? raw! : 'monthly';

  const persona = await getPersona();
  const [points, achievements, leaderboard, names] = await Promise.all([
    api<PointsView>('/gamification/points/mine'),
    api<AchievementView[]>('/gamification/achievements/mine'),
    api<LeaderboardEntry[]>(`/gamification/leaderboard?period=${period}&scope=global`),
    nameMap(),
  ]);

  return (
    <>
      <PageHeader kicker="Engagement · points never affect promotion readiness" title="Achievements" />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Total points" value={<span className="font-ledger">{points.total}</span>} />
        <Stat label="Point entries" value={<span className="font-ledger">{points.entries.length}</span>} />
        <Stat label="Achievements" value={<span className="font-ledger">{achievements.length}</span>} />
      </div>

      <div className="space-y-6">
        <Card title="Unlocked achievements">
          {achievements.length === 0 ? (
            <EmptyState>None yet — complete courses, pass assessments, earn recognition.</EmptyState>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-3">
              {achievements.map((a) => (
                <li key={a.id} className="rounded-ledger border border-ember/30 bg-ember-wash px-4 py-3">
                  <p className="font-display text-sm">{a.name}</p>
                  <p className="mt-0.5 font-ledger text-[11px] text-ink-faint">
                    {a.criterion.kind} ≥ {a.criterion.threshold}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Leaderboard">
          <Tabs
            current={period}
            hrefFor={(k) => `/achievements?period=${k}`}
            tabs={PERIODS.map((p) => ({ key: p, label: p[0]!.toUpperCase() + p.slice(1) }))}
          />
          {leaderboard.length === 0 ? (
            <EmptyState>Leaderboard not materialized for this period yet.</EmptyState>
          ) : (
            <Table head={['Rank', 'Person', 'Points']}>
              {leaderboard.map((row) => {
                const isMe = row.userId === persona?.userId;
                return (
                  <tr key={row.userId} className={isMe ? 'bg-pine-wash/60' : ''}>
                    <Td className="font-ledger">#{row.rank}</Td>
                    <Td className={isMe ? 'font-semibold' : ''}>
                      {nameOf(names, row.userId)}
                      {isMe ? ' (you)' : ''}
                    </Td>
                    <Td className="font-ledger">{row.points}</Td>
                  </tr>
                );
              })}
            </Table>
          )}
        </Card>

        <Card title="Point ledger (append-only)">
          {points.entries.length === 0 ? (
            <EmptyState>No points yet.</EmptyState>
          ) : (
            <ul>
              {points.entries.map((e) => (
                <li key={e.entryId} className="ledger-row">
                  <span className="text-sm text-ink-soft">{e.ruleId}</span>
                  <span className="font-ledger text-xs text-ink-faint">
                    +{e.points} · {new Date(e.occurredAt).toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
