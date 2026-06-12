import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Persona } from './types';

export const PERSONA_COOKIE = 'lms_persona';

/** ADR-008: the web app only knows a persona cookie; the API's AuthPort does the rest. */
export async function getPersona(): Promise<Persona | null> {
  const jar = await cookies();
  const raw = jar.get(PERSONA_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Persona;
    return parsed.userId && parsed.role ? parsed : null;
  } catch {
    return null;
  }
}

export async function requirePersona(): Promise<Persona> {
  const persona = await getPersona();
  if (!persona) redirect('/personas');
  return persona;
}
