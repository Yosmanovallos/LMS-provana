import Link from 'next/link';
import { ReactNode } from 'react';
import { api } from '@/lib/api';
import { requirePersona } from '@/lib/persona';
import { MeView } from '@/lib/types';
import { NavItem, NavLinks } from './nav-links';

/** Sidebar shell shared by the three route groups; only the nav differs. */
export async function Shell({ section, nav, children }: { section: string; nav: NavItem[]; children: ReactNode }) {
  const persona = await requirePersona();
  let unread = 0;
  try {
    unread = (await api<MeView>('/me')).unreadNotifications;
  } catch {
    // API down: pages will surface the error; the shell still renders
  }

  return (
    <div className="flex min-h-screen">
      <aside className="fixed inset-y-0 flex w-60 flex-col bg-chrome">
        <div className="border-b border-chrome-line px-5 py-5">
          <p className="font-display text-xl tracking-tight text-paper-raised">
            Provana<span className="text-ember">.</span>
          </p>
          <p className="mt-0.5 font-ledger text-[10px] uppercase tracking-[0.22em] text-chrome-dim">
            Career Ledger
          </p>
        </div>

        <div className="px-5 pb-2 pt-5">
          <p className="font-ledger text-[10px] uppercase tracking-[0.22em] text-chrome-dim">{section}</p>
        </div>
        <nav className="flex-1 overflow-y-auto pb-4">
          <NavLinks items={nav} />
        </nav>

        <div className="border-t border-chrome-line px-5 py-4">
          <Link href="/notifications" className="flex items-center justify-between text-sm text-chrome-text hover:text-paper-raised">
            Notifications
            {unread > 0 ? (
              <span className="rounded-full bg-ember px-1.5 font-ledger text-[11px] text-paper-raised">{unread}</span>
            ) : null}
          </Link>
        </div>
        <div className="border-t border-chrome-line px-5 py-4">
          <p className="truncate text-sm text-paper-raised">{persona.displayName}</p>
          <p className="font-ledger text-[11px] uppercase tracking-wider text-chrome-dim">{persona.role}</p>
          <Link href="/personas" className="mt-2 inline-block text-xs text-chrome-dim underline decoration-dotted hover:text-chrome-text">
            Switch persona
          </Link>
        </div>
      </aside>

      <main className="ml-60 w-full px-10 py-8">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
