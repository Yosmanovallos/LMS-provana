import { PlatformRole } from '@lms/contracts';
import { AuthenticatedUser } from '../../../ports/auth.port';
import { DomainEventPublisher } from '../../shared-kernel/publisher';
import { Result, err, ok } from '../../shared-kernel/result';
import { UserRepository } from '../identity.repositories';

export class AssignRoleHandler {
  constructor(
    private readonly users: UserRepository,
    private readonly publisher: DomainEventPublisher,
  ) {}

  execute(input: { userId: string; role: PlatformRole }, actor: AuthenticatedUser): Result<void> {
    if (actor.role !== 'admin') return err('forbidden', 'Only admins assign platform roles');
    const user = this.users.byId(input.userId);
    if (!user) return err('not-found', `User not found: ${input.userId}`);
    const result = user.assignRole(input.role, actor.userId);
    if (!result.ok) return result;
    this.users.save(user);
    this.publisher.publishFrom('identity', user);
    return ok(undefined);
  }
}
