import { ClockPort, IdPort } from '../../ports/system.port';
import { InProcessEventBus } from '../shared-kernel/event-bus';
import { DomainEventPublisher } from '../shared-kernel/publisher';
import { ManageRequirementSetsHandler } from './features/manage-requirement-sets';
import {
  PromotionProfileContext,
  RecalculateReadinessService,
} from './features/recalculate-readiness';
import { PromotionQueries } from './promotion.queries';
import {
  CompletionLedger,
  RequirementSetRepository,
  SnapshotStore,
} from './promotion.repositories';
import { promotionSubscriber } from './promotion.subscriptions';

export interface PromotionModule {
  manageSets: ManageRequirementSetsHandler;
  recalc: RecalculateReadinessService;
  queries: PromotionQueries;
}

export function createPromotionModule(deps: {
  publisher: DomainEventPublisher;
  bus: InProcessEventBus;
  clock: ClockPort;
  ids: IdPort;
  profileContext: PromotionProfileContext;
  teamMemberIdsOf: (managerId: string) => string[];
}): PromotionModule {
  const ledger = new CompletionLedger();
  const sets = new RequirementSetRepository();
  const snapshots = new SnapshotStore();
  const recalc = new RecalculateReadinessService(
    ledger,
    sets,
    snapshots,
    deps.profileContext,
    deps.publisher,
    deps.clock,
    deps.ids,
  );
  deps.bus.subscribe(promotionSubscriber(ledger, recalc, deps.clock, deps.ids));
  return {
    manageSets: new ManageRequirementSetsHandler(sets, deps.clock, deps.ids),
    recalc,
    queries: new PromotionQueries(snapshots, sets, ledger, deps.teamMemberIdsOf),
  };
}
