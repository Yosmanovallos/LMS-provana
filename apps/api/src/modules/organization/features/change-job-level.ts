import { AuthenticatedUser } from '../../../ports/auth.port';
import { ClockPort } from '../../../ports/system.port';
import { DomainEventPublisher } from '../../shared-kernel/publisher';
import { Result, err, ok } from '../../shared-kernel/result';
import { ProfileRepository, TaxonomyStore } from '../organization.repositories';

export class ChangeJobLevelHandler {
  constructor(
    private readonly profiles: ProfileRepository,
    private readonly taxonomy: TaxonomyStore,
    private readonly publisher: DomainEventPublisher,
    private readonly clock: ClockPort,
  ) {}

  execute(
    input: { userId: string; jobRoleId: string; jobLevelId: string },
    actor: AuthenticatedUser,
  ): Result<void> {
    if (actor.role !== 'admin') return err('forbidden', 'Only admins change job levels');
    const profile = this.profiles.byUserId(input.userId);
    if (!profile) return err('not-found', `Profile not found: ${input.userId}`);
    if (!this.taxonomy.roles.some((r) => r.id === input.jobRoleId)) {
      return err('validation', `Unknown job role: ${input.jobRoleId}`);
    }
    if (!this.taxonomy.levels.some((l) => l.id === input.jobLevelId)) {
      return err('validation', `Unknown job level: ${input.jobLevelId}`);
    }
    const result = profile.changeJobLevel(
      input.jobRoleId,
      input.jobLevelId,
      actor.userId,
      this.clock.now(),
    );
    if (!result.ok) return result;
    this.profiles.save(profile);
    this.publisher.publishFrom('organization', profile);
    return ok(undefined);
  }
}
