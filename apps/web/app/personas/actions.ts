'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { PERSONA_COOKIE } from '@/lib/persona';

export async function selectPersona(formData: FormData) {
  const userId = String(formData.get('userId') ?? '');
  const role = String(formData.get('role') ?? '');
  const displayName = String(formData.get('displayName') ?? '');
  if (!userId || !role) redirect('/personas');

  const jar = await cookies();
  jar.set(PERSONA_COOKIE, JSON.stringify({ userId, role, displayName }), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
  });
  redirect('/');
}
