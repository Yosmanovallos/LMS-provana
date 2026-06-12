import Link from 'next/link';
import { ReactNode } from 'react';

export function PageHeader({ kicker, title, aside }: { kicker: string; title: string; aside?: ReactNode }) {
  return (
    <header className="mb-8 border-b-2 border-ink pb-4">
      <p className="kicker mb-1">{kicker}</p>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-3xl tracking-tight">{title}</h1>
        {aside}
      </div>
    </header>
  );
}

export function Card({ title, children, className = '' }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`ledger-card p-5 ${className}`}>
      {title ? <h2 className="kicker mb-4 !text-ink-soft">{title}</h2> : null}
      {children}
    </section>
  );
}

const pillTones: Record<string, string> = {
  // catalog / enrollment
  published: 'bg-pine-wash text-pine-deep',
  draft: 'bg-paper-sunken text-ink-soft',
  archived: 'bg-paper-sunken text-ink-faint',
  active: 'bg-pine-wash text-pine-deep',
  completed: 'bg-pine-wash text-pine-deep',
  withdrawn: 'bg-paper-sunken text-ink-faint',
  // attempts
  'in-progress': 'bg-paper-sunken text-ink-soft',
  'awaiting-review': 'bg-ember-wash text-ember',
  passed: 'bg-pine-wash text-verdict-ok',
  failed: 'bg-red-50 text-verdict-bad',
  // evidence
  submitted: 'bg-ember-wash text-ember',
  'under-review': 'bg-ember-wash text-ember',
  approved: 'bg-pine-wash text-verdict-ok',
  rejected: 'bg-red-50 text-verdict-bad',
  // certifications / sets
  valid: 'bg-pine-wash text-verdict-ok',
  expired: 'bg-paper-sunken text-ink-faint',
  revoked: 'bg-red-50 text-verdict-bad',
  superseded: 'bg-paper-sunken text-ink-faint',
};

export function StatusPill({ status }: { status: string }) {
  const tone = pillTones[status] ?? 'bg-paper-sunken text-ink-soft';
  return (
    <span className={`inline-block rounded-ledger px-2 py-0.5 font-ledger text-[11px] uppercase tracking-wider ${tone}`}>
      {status}
    </span>
  );
}

export function Progress({ pct, tone = 'pine' }: { pct: number; tone?: 'pine' | 'ember' }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-full min-w-16 rounded-full bg-paper-sunken">
        <div
          className={`h-1.5 rounded-full ${tone === 'pine' ? 'bg-pine' : 'bg-ember'}`}
          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
        />
      </div>
      <span className="font-ledger text-xs text-ink-soft">{pct}%</span>
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="ledger-card px-5 py-4">
      <p className="kicker">{label}</p>
      <p className="mt-1 font-display text-3xl">{value}</p>
      {hint ? <p className="mt-1 text-xs text-ink-faint">{hint}</p> : null}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-ledger border border-dashed border-ink-line px-6 py-10 text-center text-sm text-ink-faint">
      {children}
    </div>
  );
}

/** Link-driven tabs (state lives in the URL, pages stay server components). */
export function Tabs({
  tabs,
  current,
  hrefFor,
}: {
  tabs: { key: string; label: string; count?: number }[];
  current: string;
  hrefFor: (key: string) => string;
}) {
  return (
    <nav className="mb-6 flex flex-wrap gap-1 border-b border-ink-line">
      {tabs.map((t) => {
        const isActive = t.key === current;
        return (
          <Link
            key={t.key}
            href={hrefFor(t.key)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm ${
              isActive
                ? 'border-ember font-semibold text-ink'
                : 'border-transparent text-ink-soft hover:border-ink-line hover:text-ink'
            }`}
          >
            {t.label}
            {t.count !== undefined ? (
              <span className="ml-1.5 font-ledger text-xs text-ink-faint">{t.count}</span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

export function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-ink">
            {head.map((h) => (
              <th key={h} className="kicker py-2 pr-4 font-normal">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-line">{children}</tbody>
      </table>
    </div>
  );
}

export function Td({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <td className={`py-2.5 pr-4 align-top ${className}`}>{children}</td>;
}
