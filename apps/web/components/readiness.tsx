import { Card, EmptyState } from '@/components/ui';
import { GapReport } from '@/lib/types';

/** Amber arc on a paper ring — the platform's signature readiness mark. */
export function ReadinessRing({ pct, size = 168 }: { pct: number; size?: number }) {
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const filled = (Math.min(100, Math.max(0, pct)) / 100) * c;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${pct}% ready`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#eeebe2" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={pct >= 100 ? '#1e7a4f' : '#b45309'}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${filled} ${c - filled}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text
        x="50%"
        y="48%"
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-ink font-display"
        fontSize={size / 4.2}
      >
        {pct}%
      </text>
      <text x="50%" y="66%" textAnchor="middle" className="fill-ink-faint font-ledger" fontSize={10} letterSpacing="0.18em">
        READY
      </text>
    </svg>
  );
}

export function GapReportPanel({ report, subjectName }: { report: GapReport | null; subjectName: string }) {
  if (!report) {
    return (
      <EmptyState>
        No readiness snapshot for {subjectName} yet — an active requirement set must target their current
        role &amp; level, and at least one qualifying completion must land in the ledger.
      </EmptyState>
    );
  }
  return (
    <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
      <Card className="flex flex-col items-center justify-center gap-2 px-10">
        <ReadinessRing pct={report.percentReady} />
        <p className="text-center text-sm text-ink-soft">
          toward <span className="font-semibold text-ink">{report.targetRoleLevel.jobRoleId} · {report.targetRoleLevel.jobLevelId}</span>
        </p>
        <p className="font-ledger text-[11px] text-ink-faint">
          requirement set v{report.requirementSetVersion} · {new Date(report.computedAt).toLocaleDateString()}
        </p>
      </Card>

      <div className="space-y-6">
        <Card title={`Outstanding — ${report.missing.length}`}>
          {report.missing.length === 0 ? (
            <p className="text-sm text-verdict-ok">Nothing outstanding. Promotion eligible.</p>
          ) : (
            <ul>
              {report.missing.map((m) => (
                <li key={m.label} className="ledger-row">
                  <span className="text-sm">
                    <span className="mr-2 font-ledger text-xs uppercase text-ember">{m.kind}</span>
                    {m.label}
                  </span>
                  <span className="font-ledger text-xs text-ink-faint">{m.weight} pts</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title={`Satisfied — ${report.satisfied.length}`}>
          {report.satisfied.length === 0 ? (
            <p className="text-sm text-ink-faint">Nothing recorded yet.</p>
          ) : (
            <ul>
              {report.satisfied.map((m) => (
                <li key={m.label} className="ledger-row">
                  <span className="text-sm text-ink-soft">
                    <span className="mr-2 font-ledger text-xs text-verdict-ok">✓</span>
                    {m.label}
                  </span>
                  <span className="font-ledger text-xs text-ink-faint">{m.weight} pts</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
