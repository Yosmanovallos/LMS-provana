import { ReactNode } from 'react';
import { Shell } from '@/components/shell';

const nav = [
  { href: '/team', label: 'My Team' },
  { href: '/review/evidence', label: 'Evidence Queue' },
  { href: '/review/assessments', label: 'Assessment Queue' },
  { href: '/readiness', label: 'Team Readiness' },
  { href: '/analytics', label: 'Analytics' },
];

export default function ManagerLayout({ children }: { children: ReactNode }) {
  return (
    <Shell section="Lead" nav={nav}>
      {children}
    </Shell>
  );
}
