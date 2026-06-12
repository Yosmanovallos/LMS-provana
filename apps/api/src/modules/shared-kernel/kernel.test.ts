import { describe, expect, it } from 'vitest';
import { DomainEventRecord } from '@lms/contracts';
import { FixedClock, SequentialIds } from '../../adapters/system.adapter';
import { AggregateRoot } from './aggregate-root';
import { InProcessEventBus } from './event-bus';
import { InMemoryOutboxStore } from './outbox';
import { hasPermission } from './permissions';
import { DomainEventPublisher, OutboxDispatcher } from './publisher';

class TestAggregate extends AggregateRoot {
  completeCourse(userId: string) {
    this.recordEvent('CourseCompleted', 'enr-1', {
      userId,
      enrollmentId: 'enr-1',
      courseId: 'c-1',
    });
  }
  recordInvalid() {
    // missing courseId — must be rejected by the contract validation
    this.recordEvent('CourseCompleted', 'enr-1', { userId: 'u1', enrollmentId: 'enr-1' } as never);
  }
}

function setup() {
  const outbox = new InMemoryOutboxStore();
  const bus = new InProcessEventBus();
  const dispatcher = new OutboxDispatcher(outbox, bus);
  const publisher = new DomainEventPublisher(outbox, dispatcher, new SequentialIds('evt'), new FixedClock());
  return { outbox, bus, dispatcher, publisher };
}

describe('outbox round-trip (Phase 0 exit criterion)', () => {
  it('delivers a recorded event to a subscriber exactly once, even when flushed twice', () => {
    const { bus, dispatcher, publisher, outbox } = setup();
    const received: DomainEventRecord[] = [];
    bus.subscribe({ name: 'test-consumer', eventTypes: ['CourseCompleted'], handle: (e) => received.push(e) });

    const agg = new TestAggregate();
    agg.completeCourse('u1');
    publisher.publishFrom('learning', agg);
    dispatcher.flush(); // simulate redundant dispatcher run

    expect(received).toHaveLength(1);
    expect(received[0]!.type).toBe('CourseCompleted');
    expect(received[0]!.context).toBe('learning');
    expect(outbox.all()).toHaveLength(1);
    expect(outbox.pending()).toHaveLength(0);
    expect(agg.pullEvents()).toHaveLength(0); // drained
  });

  it('cascades: a consumer publishing during handling gets its event delivered too', () => {
    const { bus, publisher } = setup();
    const delivered: string[] = [];
    bus.subscribe({
      name: 'cascade-source',
      eventTypes: ['CourseCompleted'],
      handle: (e) => {
        delivered.push(e.type);
        publisher.publishPending('promotion', [
          {
            type: 'ReadinessRecalculated',
            aggregateId: 'u1',
            payload: { userId: 'u1', snapshotId: 's1', percentReady: 50 },
          },
        ]);
      },
    });
    bus.subscribe({ name: 'cascade-sink', eventTypes: ['ReadinessRecalculated'], handle: (e) => delivered.push(e.type) });

    const agg = new TestAggregate();
    agg.completeCourse('u1');
    publisher.publishFrom('learning', agg);

    expect(delivered).toEqual(['CourseCompleted', 'ReadinessRecalculated']);
  });

  it('only delivers to subscribers of the event type, supports "all" subscribers', () => {
    const { bus, publisher } = setup();
    const all: string[] = [];
    const none: string[] = [];
    bus.subscribe({ name: 'audit', eventTypes: 'all', handle: (e) => all.push(e.type) });
    bus.subscribe({ name: 'other', eventTypes: ['PathCompleted'], handle: (e) => none.push(e.type) });

    const agg = new TestAggregate();
    agg.completeCourse('u1');
    publisher.publishFrom('learning', agg);

    expect(all).toEqual(['CourseCompleted']);
    expect(none).toEqual([]);
  });

  it('rejects payloads violating the contract schema', () => {
    const { publisher } = setup();
    const agg = new TestAggregate();
    agg.recordInvalid();
    expect(() => publisher.publishFrom('learning', agg)).toThrow(/contract violation/i);
  });

  it('rejects duplicate subscriber names', () => {
    const { bus } = setup();
    bus.subscribe({ name: 'dup', eventTypes: 'all', handle: () => undefined });
    expect(() => bus.subscribe({ name: 'dup', eventTypes: 'all', handle: () => undefined })).toThrow();
  });
});

describe('permission catalog', () => {
  it('grants the documented baseline per role', () => {
    expect(hasPermission('employee', 'evidence.submit')).toBe(true);
    expect(hasPermission('employee', 'evidence.review')).toBe(false);
    expect(hasPermission('manager', 'evidence.review')).toBe(true);
    expect(hasPermission('manager', 'requirement-sets.manage')).toBe(false);
    expect(hasPermission('admin', 'requirement-sets.manage')).toBe(true);
  });
});
