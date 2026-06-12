import { IdPort } from '../../ports/system.port';
import { DomainEventPublisher } from '../shared-kernel/publisher';
import { AssignRoleHandler } from './features/assign-role';
import { RegisterUserHandler } from './features/register-user';
import { IdentityQueries } from './identity.queries';
import { InMemoryUserRepository, UserRepository } from './identity.repositories';

export interface IdentityModule {
  registerUser: RegisterUserHandler;
  assignRole: AssignRoleHandler;
  queries: IdentityQueries;
  repo: UserRepository;
}

export function createIdentityModule(deps: {
  publisher: DomainEventPublisher;
  ids: IdPort;
}): IdentityModule {
  const repo = new InMemoryUserRepository();
  return {
    registerUser: new RegisterUserHandler(repo, deps.publisher, deps.ids),
    assignRole: new AssignRoleHandler(repo, deps.publisher),
    queries: new IdentityQueries(repo),
    repo,
  };
}
