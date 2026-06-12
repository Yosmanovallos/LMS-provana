import { getPersona } from './persona';
import { Persona, UserView } from './types';

const API_URL = process.env.API_URL ?? 'http://localhost:3001';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Typed fetch wrapper: server-only, forwards the dev persona headers (ADR-008). */
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const persona = await getPersona();
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        'content-type': 'application/json',
        ...(persona ? { 'x-user-id': persona.userId, 'x-user-role': persona.role } : {}),
        ...init?.headers,
      },
      cache: 'no-store',
    });
  } catch {
    throw new ApiError(0, `API unreachable at ${API_URL} — start it with: pnpm --filter @lms/api dev`);
  }
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = (await res.json()) as { message?: string };
      if (body.message) message = body.message;
    } catch {
      // non-JSON error body; keep the status message
    }
    throw new ApiError(res.status, message);
  }
  // Result<void> handlers produce an empty body (e.g. mark-read, activate)
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return api<T>(path, {
    method: 'POST',
    body: body === undefined ? '{}' : JSON.stringify(body),
  });
}

export function apiPut<T>(path: string, body: unknown): Promise<T> {
  return api<T>(path, { method: 'PUT', body: JSON.stringify(body) });
}

/**
 * userId → displayName. Seeded personas are public; /users adds the rest for
 * manager/admin actors (employees get an empty list back, never an error).
 */
export async function nameMap(): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  try {
    for (const p of await api<Persona[]>('/dev/personas')) map[p.userId] = p.displayName;
    for (const u of await api<UserView[]>('/users')) map[u.id] = u.displayName;
  } catch {
    // names are a nicety; pages fall back to raw ids
  }
  return map;
}

export const nameOf = (map: Record<string, string>, userId: string): string =>
  map[userId] ?? `${userId.slice(0, 8)}…`;
