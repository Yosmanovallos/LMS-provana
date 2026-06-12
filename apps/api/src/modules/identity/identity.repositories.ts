import { User } from './domain/user';

export interface UserRepository {
  byId(id: string): User | null;
  byEmail(email: string): User | null;
  byExternalAuthId(externalAuthId: string): User | null;
  save(user: User): void;
  list(): User[];
}

export class InMemoryUserRepository implements UserRepository {
  private users = new Map<string, User>();

  byId(id: string): User | null {
    return this.users.get(id) ?? null;
  }
  byEmail(email: string): User | null {
    return this.list().find((u) => u.email === email.toLowerCase()) ?? null;
  }
  byExternalAuthId(externalAuthId: string): User | null {
    return this.list().find((u) => u.externalAuthId === externalAuthId) ?? null;
  }
  save(user: User): void {
    this.users.set(user.id, user);
  }
  list(): User[] {
    return [...this.users.values()];
  }
}
