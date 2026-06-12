import { PlatformRole } from '@lms/contracts';
import { AuthenticatedUser } from '../../../ports/auth.port';
import { DomainEventPublisher } from '../../shared-kernel/publisher';
import { Result, err, ok } from '../../shared-kernel/result';
import { ProfileRepository } from '../organization.repositories';

export class AssignManagerHandler {
  constructor(
    private readonly profiles: ProfileRepository,
    private readonly publisher: DomainEventPublisher,
    /** Injected from identity via the container — no cross-module import. */
    private readonly getUserRole: (userId: string) => PlatformRole | null,
  ) {}

  execute(input: { userId: string; managerId: string }, actor: AuthenticatedUser): Result<void> {
    if (actor.role !== 'admin') return err('forbidden', 'Only admins assign managers');
    const profile = this.profiles.byUserId(input.userId);
    if (!profile) return err('not-found', `Profile not found: ${input.userId}`);
    const managerRole = this.getUserRole(input.managerId);
    if (managerRole !== 'manager' && managerRole !== 'admin') {
      return err('validation', 'Assigned manager must hold the manager or admin role');
    }
    const result = profile.assignManager(input.managerId, actor.userId);
    if (!result.ok) return result;
    this.profiles.save(profile);
    this.publisher.publishFrom('organization', profile);
    return ok(undefined);
  }
}
