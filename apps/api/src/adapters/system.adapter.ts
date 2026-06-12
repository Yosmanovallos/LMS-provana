import { randomUUID } from 'node:crypto';
import { ClockPort, IdPort } from '../ports/system.port';

export class SystemClock implements ClockPort {
  now(): Date {
    return new Date();
  }
}

export class UuidIds implements IdPort {
  next(): string {
    return randomUUID();
  }
}

/** Deterministic test doubles. */
export class FixedClock implements ClockPort {
  constructor(private current: Date = new Date('2026-06-11T12:00:00.000Z')) {}
  now(): Date {
    return this.current;
  }
  set(date: Date): void {
    this.current = date;
  }
  advanceDays(days: number): void {
    this.current = new Date(this.current.getTime() + days * 86_400_000);
  }
}

export class SequentialIds implements IdPort {
  private counter = 0;
  constructor(private readonly prefix = 'id') {}
  next(): string {
    return `${this.prefix}-${++this.counter}`;
  }
}
