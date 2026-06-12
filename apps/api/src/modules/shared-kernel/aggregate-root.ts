import { EventPayload, EventType } from '@lms/contracts';

export interface PendingEvent<T extends EventType = EventType> {
  type: T;
  aggregateId: string;
  payload: EventPayload<T>;
}

export abstract class AggregateRoot {
  private pendingEvents: PendingEvent[] = [];

  protected recordEvent<T extends EventType>(
    type: T,
    aggregateId: string,
    payload: EventPayload<T>,
  ): void {
    this.pendingEvents.push({ type, aggregateId, payload } as PendingEvent);
  }

  /** Drains pending events — called by the publisher inside the unit of work. */
  pullEvents(): PendingEvent[] {
    const events = this.pendingEvents;
    this.pendingEvents = [];
    return events;
  }
}
