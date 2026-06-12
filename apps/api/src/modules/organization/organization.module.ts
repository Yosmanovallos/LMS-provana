import { PlatformRole } from '@lms/contracts';
import { ClockPort, IdPort } from '../../ports/system.port';
import { InProcessEventBus } from '../shared-kernel/event-bus';
import { DomainEventPublisher } from '../shared-kernel/publisher';
import { AssignManagerHandler } from './features/assign-manager';
import { ChangeJobLevelHandler } from './features/change-job-level';
import { OrganizationQueries } from './organization.queries';
import {
  InMemoryProfileRepository,
  InMemoryTeamRepository,
  ProfileRepository,
  TaxonomyStore,
} from './organization.repositories';
import { profileSyncSubscriber } from './organization.subscriptions';

export interface OrganizationModule {
  assignManager: AssignManagerHandler;
  changeJobLevel: ChangeJobLevelHandler;
  queries: OrganizationQueries;
  profiles: ProfileRepository;
  taxonomy: TaxonomyStore;
  teams: InMemoryTeamRepository;
}

export function createOrganizationModule(deps: {
  publisher: DomainEventPublisher;
  bus: InProcessEventBus;
  clock: ClockPort;
  ids: IdPort;
  getUserRole: (userId: string) => PlatformRole | null;
}): OrganizationModule {
  const profiles = new InMemoryProfileRepository();
  const taxonomy = new TaxonomyStore();
  const teams = new InMemoryTeamRepository();
  deps.bus.subscribe(profileSyncSubscriber(profiles));
  return {
    assignManager: new AssignManagerHandler(profiles, deps.publisher, deps.getUserRole),
    changeJobLevel: new ChangeJobLevelHandler(profiles, taxonomy, deps.publisher, deps.clock),
    queries: new OrganizationQueries(profiles, taxonomy, teams),
    profiles,
    taxonomy,
    teams,
  };
}
