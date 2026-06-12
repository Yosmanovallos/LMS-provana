import { platformRoleSchema } from '@lms/contracts';
import { AuthPort, AuthenticatedUser } from '../ports/auth.port';

/**
 * AUTH_MODE=dev (ADR-008): trusts x-user-id / x-user-role headers. Never enable outside
 * local/demo. ClerkAuthAdapter (JWT verification) fills the same port in production.
 */
export class DevAuthAdapter implements AuthPort {
  authenticate(
    headers: Record<string, string | string[] | undefined>,
  ): AuthenticatedUser | null {
    const userId = headers['x-user-id'];
    const role = platformRoleSchema.safeParse(headers['x-user-role']);
    if (typeof userId !== 'string' || userId.length === 0 || !role.success) return null;
    return { userId, role: role.data };
  }
}
