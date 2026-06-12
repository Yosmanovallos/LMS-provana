import { PlatformRole } from '@lms/contracts';
import { AggregateRoot } from '../../shared-kernel/aggregate-root';
import { Result, err, ok } from '../../shared-kernel/result';

export type UserStatus = 'active' | 'inactive';

export class User extends AggregateRoot {
  private constructor(
    public readonly id: string,
    public readonly externalAuthId: string,
    public readonly email: string,
    public displayName: string,
    public role: PlatformRole,
    public status: UserStatus,
  ) {
    super();
  }

  static register(props: {
    id: string;
    externalAuthId: string;
    email: string;
    displayName: string;
    role?: PlatformRole;
  }): Result<User> {
    if (!props.email.includes('@')) return err('validation', `Invalid email: ${props.email}`);
    if (props.displayName.trim().length === 0) return err('validation', 'Display name required');
    const user = new User(
      props.id,
      props.externalAuthId,
      props.email.toLowerCase(),
      props.displayName.trim(),
      props.role ?? 'employee',
      'active',
    );
    user.recordEvent('UserRegistered', user.id, {
      userId: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
    });
    return ok(user);
  }

  assignRole(role: PlatformRole, assignedBy: string): Result<void> {
    if (this.status !== 'active') return err('invariant', 'Cannot change role of inactive user');
    if (this.role === role) return ok(undefined);
    this.role = role;
    this.recordEvent('RoleAssigned', this.id, { userId: this.id, role, assignedBy });
    return ok(undefined);
  }

  /** Soft deactivation only — users are never deleted (audit). */
  deactivate(): void {
    this.status = 'inactive';
  }
}
