import { FixedClock, SequentialIds } from '../../adapters/system.adapter';
import { InProcessEventBus } from './event-bus';
import { InMemoryOutboxStore } from './outbox';
import { DomainEventPublisher, OutboxDispatcher } from './publisher';

export interface Kernel {
  outbox: InMemoryOutboxStore;
  bus: InProcessEventBus;
  dispatcher: OutboxDispatcher;
  publisher: DomainEventPublisher;
  clock: FixedClock;
  ids: SequentialIds;
}

/** Deterministic kernel for module tests and the dev composition root. */
export function createTestKernel(): Kernel {
  const outbox = new InMemoryOutboxStore();
  const bus = new InProcessEventBus();
  const dispatcher = new OutboxDispatcher(outbox, bus);
  const clock = new FixedClock();
  const ids = new SequentialIds('evt');
  const publisher = new DomainEventPublisher(outbox, dispatcher, ids, clock);
  return { outbox, bus, dispatcher, publisher, clock, ids };
}
