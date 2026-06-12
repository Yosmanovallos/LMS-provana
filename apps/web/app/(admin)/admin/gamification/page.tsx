import { api } from '@/lib/api';
import { PointRuleView } from '@/lib/types';
import { Card, PageHeader } from '@/components/ui';
import { materializeLeaderboardsAction, updateRuleAction } from './actions';

export default async function GamificationConfigPage() {
  const rules = await api<PointRuleView[]>('/gamification/rules');

  return (
    <>
      <PageHeader
        kicker="Admin · engagement only, never readiness"
        title="Gamification rules"
        aside={
          <form action={materializeLeaderboardsAction}>
            <button type="submit" className="btn-quiet text-xs">
              Materialize leaderboards now
            </button>
          </form>
        }
      />

      <div className="space-y-4">
        {rules.map((rule) => (
          <Card key={rule.ruleId}>
            <form action={updateRuleAction.bind(null, rule.ruleId)} className="flex flex-wrap items-end gap-4">
              <div className="min-w-48 flex-1">
                <p className="text-sm font-semibold">{rule.ruleId}</p>
                <p className="font-ledger text-[11px] text-ink-faint">on {rule.eventType}</p>
              </div>
              <label className="text-sm">
                <span className="kicker mb-1 block">Points</span>
                <input type="number" name="points" min={0} defaultValue={rule.points} required className="field !w-28" />
              </label>
              <label className="text-sm">
                <span className="kicker mb-1 block">Daily cap / user</span>
                <input
                  type="number"
                  name="dailyCapPerUser"
                  min={0}
                  defaultValue={rule.dailyCapPerUser ?? ''}
                  placeholder="none"
                  className="field !w-28"
                />
              </label>
              <button type="submit" className="btn-primary !py-1.5 text-xs">
                Save
              </button>
            </form>
          </Card>
        ))}
      </div>
    </>
  );
}
