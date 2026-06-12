import { PlatformRole } from '@lms/contracts';
import { DomainEventPublisher } from '../../shared-kernel/publisher';
import { Result, err, ok } from '../../shared-kernel/result';
import { IdPort } from '../../../ports/system.port';
import { User } from '../domain/user';
import { UserRepository } from '../identity.repositories';

export interface RegisterUserInput {
  externalAuthId: string;
  email: string;
  displayName: string;
  role?: PlatformRole;
}

/** Invoked by the auth webhook (Clerk user.created) or by admin/seed. */
export class RegisterUserHandler {
  constructor(
    private readonly users: UserRepository,
    private readonly publisher: DomainEventPublisher,
    private readonly ids: IdPort,
  ) {}

  execute(input: RegisterUserInput): Result<{ userId: string }> {
    if (this.users.byEmail(input.email)) {
      return err('conflict', `Email already registered: ${input.email}`);
    }
    if (this.users.byExternalAuthId(input.externalAuthId)) {
      return err('conflict', 'External auth id already registered');
    }
    const created = User.register({ id: this.ids.next(), ...input });
    if (!created.ok) return created;
    this.users.save(created.value);
    this.publisher.publishFrom('identity', created.value);
    return ok({ userId: created.value.id });
  }
}
