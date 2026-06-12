'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export interface NavItem {
  href: string;
  label: string;
}

export function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <ul className="space-y-0.5">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              className={`group flex items-center gap-2.5 border-l-2 px-4 py-2 text-sm transition-colors ${
                active
                  ? 'border-ember bg-chrome-line/40 text-paper-raised'
                  : 'border-transparent text-chrome-text hover:border-chrome-dim hover:text-paper-raised'
              }`}
            >
              <span
                className={`font-ledger text-[10px] ${active ? 'text-ember' : 'text-chrome-dim group-hover:text-chrome-text'}`}
              >
                ▸
              </span>
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
