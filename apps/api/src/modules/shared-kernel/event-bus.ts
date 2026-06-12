import { DomainEventRecord, EventType } from '@lms/contracts';

export interface EventSubscriber {
  /** Stable consumer name — the idempotency ledger key is `${name}:${eventId}`. */
  name: string;
  eventTypes: EventType[] | 'all';
  handle(event: DomainEventRecord): void;
}

/**
 * In-process event bus with at-least-once delivery semantics made safe: a per-consumer
 * processed-ledger guarantees each subscriber sees each event exactly once even if the
 * dispatcher re-delivers. Maps 1:1 to Service Bus topic subscriptions later.
 */
export class InProcessEventBus {
  private subscribers: EventSubscriber[] = [];
  private processed = new Set<string>();

  subscribe(subscriber: EventSubscriber): void {
    if (this.subscribers.some((s) => s.name === subscriber.name)) {
      throw new Error(`Duplicate subscriber name: ${subscriber.name}`);
    }
    this.subscribers.push(subscriber);
  }

  dispatch(event: DomainEventRecord): void {
    for (const sub of this.subscribers) {
      if (sub.eventTypes !== 'all' && !sub.eventTypes.includes(event.type)) continue;
      const key = `${sub.name}:${event.id}`;
      if (this.processed.has(key)) continue;
      this.processed.add(key);
      sub.handle(event);
    }
  }
}
