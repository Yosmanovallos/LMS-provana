import { DomainEventRecord, EventPayload } from '@lms/contracts';
import { EventSubscriber, InProcessEventBus } from '../shared-kernel/event-bus';
import { OutboxStore } from '../shared-kernel/outbox';

/**
 * Read-model projections (master plan §7.9): pure event consumer, no aggregates.
 * Disposable by design — rebuild() replays the audit log from zero.
 */
export class AnalyticsProjections {
  private enrollments = new Map<string, { userId: string }>();
  private completionsByUser = new Map<string, number>();
  private enrollmentsByUser = new Map<string, number>();
  /** managerId → member userIds ("team" = manager scope at MVP). */
  private teams = new Map<string, Set<string>>();
  /** ISO week (YYYY-Www) → { completions, activeUsers } */
  private weeks = new Map<string, { completions: number; activeUsers: Set<string> }>();
  private latestReadiness = new Map<string, number>();

  apply(event: DomainEventRecord): void {
    const week = isoWeek(new Date(event.occurredAt));
    switch (event.type) {
      case 'EmployeeAssignedToManager': {
        const p = event.payload as EventPayload<'EmployeeAssignedToManager'>;
        for (const members of this.teams.values()) members.delete(p.userId);
        if (!this.teams.has(p.managerId)) this.teams.set(p.managerId, new Set());
        this.teams.get(p.managerId)!.add(p.userId);
        break;
      }
      case 'EnrollmentCreated': {
        const p = event.payload as EventPayload<'EnrollmentCreated'>;
        if (p.targetKind !== 'course') break;
        this.enrollments.set(p.enrollmentId, { userId: p.userId });
        this.enrollmentsByUser.set(p.userId, (this.enrollmentsByUser.get(p.userId) ?? 0) + 1);
        this.touch(week, p.userId);
        break;
      }
      case 'LessonCompleted': {
        const p = event.payload as EventPayload<'LessonCompleted'>;
        this.touch(week, p.userId);
        break;
      }
      case 'CourseCompleted': {
        const p = event.payload as EventPayload<'CourseCompleted'>;
        this.completionsByUser.set(p.userId, (this.completionsByUser.get(p.userId) ?? 0) + 1);
        const bucket = this.touch(week, p.userId);
        bucket.completions += 1;
        break;
      }
      case 'ReadinessRecalculated': {
        const p = event.payload as EventPayload<'ReadinessRecalculated'>;
        this.latestReadiness.set(p.userId, p.percentReady);
        break;
      }
      default:
        break;
    }
  }

  /** Rebuild from the event log; must equal the incrementally built state. */
  rebuild(events: DomainEventRecord[]): void {
    this.enrollments.clear();
    this.completionsByUser.clear();
    this.enrollmentsByUser.clear();
    this.teams.clear();
    this.weeks.clear();
    this.latestReadiness.clear();
    for (const event of events) this.apply(event);
  }

  completionRateByTeam(): { managerId: string; enrolled: number; completed: number; ratePct: number }[] {
    return [...this.teams.entries()].map(([managerId, members]) => {
      let enrolled = 0;
      let completed = 0;
      for (const userId of members) {
        enrolled += this.enrollmentsByUser.get(userId) ?? 0;
        completed += this.completionsByUser.get(userId) ?? 0;
      }
      return {
        managerId,
        enrolled,
        completed,
        ratePct: enrolled === 0 ? 0 : Math.round((completed / enrolled) * 100),
      };
    });
  }

  learningVelocity(): { week: string; completions: number }[] {
    return [...this.weeks.entries()]
      .map(([week, b]) => ({ week, completions: b.completions }))
      .sort((a, b) => a.week.localeCompare(b.week));
  }

  activeLearners(): { week: string; count: number }[] {
    return [...this.weeks.entries()]
      .map(([week, b]) => ({ week, count: b.activeUsers.size }))
      .sort((a, b) => a.week.localeCompare(b.week));
  }

  teamProgress(managerId: string): { userId: string; enrolled: number; completed: number }[] {
    return [...(this.teams.get(managerId) ?? [])].map((userId) => ({
      userId,
      enrolled: this.enrollmentsByUser.get(userId) ?? 0,
      completed: this.completionsByUser.get(userId) ?? 0,
    }));
  }

  readinessDistribution(): { bucket: string; count: number }[] {
    const buckets = [
      { bucket: '0-25', min: 0, max: 25 },
      { bucket: '26-50', min: 26, max: 50 },
      { bucket: '51-75', min: 51, max: 75 },
      { bucket: '76-99', min: 76, max: 99 },
      { bucket: '100', min: 100, max: 100 },
    ];
    return buckets.map(({ bucket, min, max }) => ({
      bucket,
      count: [...this.latestReadiness.values()].filter((v) => v >= min && v <= max).length,
    }));
  }

  private touch(week: string, userId: string): { completions: number; activeUsers: Set<string> } {
    if (!this.weeks.has(week)) this.weeks.set(week, { completions: 0, activeUsers: new Set() });
    const bucket = this.weeks.get(week)!;
    bucket.activeUsers.add(userId);
    return bucket;
  }
}

function isoWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export interface AnalyticsModule {
  projections: AnalyticsProjections;
  /** Rebuild from the audit log (outbox) — replay-equality is tested. */
  rebuild: () => void;
}

export function createAnalyticsModule(deps: {
  bus: InProcessEventBus;
  outbox: OutboxStore;
}): AnalyticsModule {
  const projections = new AnalyticsProjections();
  const subscriber: EventSubscriber = {
    name: 'analytics.projections',
    eventTypes: 'all',
    handle: (event) => projections.apply(event),
  };
  deps.bus.subscribe(subscriber);
  return {
    projections,
    rebuild: () => projections.rebuild(deps.outbox.all()),
  };
}
