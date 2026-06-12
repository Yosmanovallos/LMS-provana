import { PlatformRole } from '@lms/contracts';
import { UserRepository } from './identity.repositories';

export interface UserView {
  id: string;
  email: string;
  displayName: string;
  role: PlatformRole;
  status: string;
}

/** Public query interface — the only read surface other layers may use. */
export class IdentityQueries {
  constructor(private readonly users: UserRepository) {}

  getUser(userId: string): UserView | null {
    const u = this.users.byId(userId);
    return u
      ? { id: u.id, email: u.email, displayName: u.displayName, role: u.role, status: u.status }
      : null;
  }

  getRole(userId: string): PlatformRole | null {
    return this.users.byId(userId)?.role ?? null;
  }

  listUsers(): UserView[] {
    return this.users.list().map((u) => ({
      id: u.id,
      email: u.email,
      displayName: u.displayName,
      role: u.role,
      status: u.status,
    }));
  }
}
