import { PlatformRole } from '@lms/contracts';

export interface AuthenticatedUser {
  userId: string;
  role: PlatformRole;
}

/**
 * Authentication only — authorization is always ours (ADR-002). MVP adapters:
 * DevAuthAdapter (headers) and ClerkAuthAdapter (JWT, slot); Azure: Entra OIDC.
 */
export interface AuthPort {
  authenticate(headers: Record<string, string | string[] | undefined>): AuthenticatedUser | null;
}
