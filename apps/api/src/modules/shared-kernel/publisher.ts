import { DomainEventRecord, validateEventPayload } from '@lms/contracts';
import { ClockPort, IdPort } from '../../ports/system.port';
import { AggregateRoot, PendingEvent } from './aggregate-root';
import { InProcessEventBus } from './event-bus';
import { OutboxStore } from './outbox';

/**
 * Dispatches pending outbox entries to the bus. Loops until the outbox drains, because
 * consumers may publish follow-on events while handling (e.g. CourseCompleted →
 * ledger fact → ReadinessRecalculated). Re-entrant calls are absorbed by the outer loop.
 */
export class OutboxDispatcher {
  private flushing = false;

  constructor(
    private readonly outbox: OutboxStore,
    private readonly bus: InProcessEventBus,
  ) {}

  flush(): void {
    if (this.flushing) return;
    this.flushing = true;
    try {
      let pending = this.outbox.pending();
      let guard = 0;
      while (pending.length > 0) {
        if (++guard > 1000) throw new Error('Outbox dispatch did not converge (event loop?)');
        for (const event of pending) {
          this.outbox.markDispatched([event.id]);
          this.bus.dispatch(event);
        }
        pending = this.outbox.pending();
      }
    } finally {
      this.flushing = false;
    }
  }
}

/**
 * The unit-of-work seam: drains aggregates' recorded events, validates payloads against
 * the @lms/contracts schemas, appends to the outbox, then triggers dispatch.
 */
export class DomainEventPublisher {
  constructor(
    private readonly outbox: OutboxStore,
    private readonly dispatcher: OutboxDispatcher,
    private readonly ids: IdPort,
    private readonly clock: ClockPort,
  ) {}

  publishFrom(context: string, ...aggregates: AggregateRoot[]): DomainEventRecord[] {
    const pending = aggregates.flatMap((a) => a.pullEvents());
    return this.publishPending(context, pending);
  }

  publishPending(context: string, pending: PendingEvent[]): DomainEventRecord[] {
    const records: DomainEventRecord[] = pending.map((p) => {
      const check = validateEventPayload(p.type, p.payload);
      if (!check.ok) {
        throw new Error(`Event contract violation for ${p.type}: ${check.error}`);
      }
      return {
        id: this.ids.next(),
        type: p.type,
        context,
        aggregateId: p.aggregateId,
        occurredAt: this.clock.now().toISOString(),
        payload: p.payload,
      };
    });
    if (records.length > 0) {
      this.outbox.append(records);
      this.dispatcher.flush();
    }
    return records;
  }
}
