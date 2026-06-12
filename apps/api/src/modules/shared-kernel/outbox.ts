import { DomainEventRecord } from '@lms/contracts';

/**
 * Transactional outbox (ADR-004): events are persisted with the state change, then
 * dispatched. The store is also the audit trail and the replay source — append-only.
 */
export interface OutboxStore {
  append(events: DomainEventRecord[]): void;
  pending(): DomainEventRecord[];
  markDispatched(ids: string[]): void;
  /** Full append-only log in occurrence order (audit / projection rebuild). */
  all(): DomainEventRecord[];
}

export class InMemoryOutboxStore implements OutboxStore {
  private log: DomainEventRecord[] = [];
  private dispatched = new Set<string>();

  append(events: DomainEventRecord[]): void {
    this.log.push(...events);
  }

  pending(): DomainEventRecord[] {
    return this.log.filter((e) => !this.dispatched.has(e.id));
  }

  markDispatched(ids: string[]): void {
    for (const id of ids) this.dispatched.add(id);
  }

  all(): DomainEventRecord[] {
    return [...this.log];
  }
}
