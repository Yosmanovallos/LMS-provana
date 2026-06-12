import { ReactNode } from 'react';
import { Shell } from '@/components/shell';

const nav = [
  { href: '/my-learning', label: 'My Learning' },
  { href: '/catalog', label: 'Catalog' },
  { href: '/assessments', label: 'Assessments' },
  { href: '/evidence', label: 'Evidence' },
  { href: '/achievements', label: 'Achievements' },
  { href: '/career', label: 'Career' },
];

export default function EmployeeLayout({ children }: { children: ReactNode }) {
  return (
    <Shell section="Grow" nav={nav}>
      {children}
    </Shell>
  );
}
