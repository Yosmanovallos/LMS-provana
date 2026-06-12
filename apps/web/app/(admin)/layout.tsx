import { ReactNode } from 'react';
import { Shell } from '@/components/shell';

const nav = [
  { href: '/admin/catalog', label: 'Catalog Builder' },
  { href: '/admin/requirement-sets', label: 'Requirement Sets' },
  { href: '/admin/gamification', label: 'Gamification' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/audit', label: 'Audit' },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <Shell section="Operate" nav={nav}>
      {children}
    </Shell>
  );
}
