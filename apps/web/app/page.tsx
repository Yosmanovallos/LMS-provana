import { redirect } from 'next/navigation';
import { requirePersona } from '@/lib/persona';

const homeByRole = {
  employee: '/my-learning',
  manager: '/team',
  admin: '/admin/catalog',
} as const;

export default async function Home() {
  const persona = await requirePersona();
  redirect(homeByRole[persona.role] ?? '/my-learning');
}
