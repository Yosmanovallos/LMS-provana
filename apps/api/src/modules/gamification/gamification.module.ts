import { EventPayload, EventType, LeaderboardPeriod } from '@lms/contracts';
import { AuthenticatedUser } from '../../ports/auth.port';
import { ClockPort, IdPort } from '../../ports/system.port';
import { EventSubscriber, InProcessEventBus } from '../shared-kernel/event-bus';
import { DomainEventPublisher } from '../shared-kernel/publisher';
import { Result, err, ok } from '../shared-kernel/result';

/**
 * Gamification (engagement only — firewall-separated from Promotion; the boundary lint
 * guarantees no promotion import, and readiness math never sees points).
 */

export interface PointRule {
  ruleId: string;
  eventType: EventType;
  points: number;
  dailyCapPerUser?: number;
}

export interface PointEntry {
  entryId: string;
  userId: string;
  ruleId: string;
  points: number;
  sourceEventId: string;
  occurredAt: string;
}

export interface Achievement {
  id: string;
  name: string;
  criterion: { kind: 'points-total' | 'courses-completed'; threshold: number };
}

/** Append-only, idempotent on sourceEventId. */
export class PointLedger {
  private entries: PointEntry[] = [];
  private bySource = new Set<string>();

  append(entry: PointEntry): boolean {
    if (this.bySource.has(entry.sourceEventId)) return false;
    this.bySource.add(entry.sourceEventId);
    this.entries.push(entry);
    return true;
  }

  of(userId: string): PointEntry[] {
    return this.entries.filter((e) => e.userId === userId);
  }

  totalOf(userId: string): number {
    return this.of(userId).reduce((sum, e) => sum + e.points, 0);
  }

  all(): PointEntry[] {
    return [...this.entries];
  }

  awardedToday(userId: string, ruleId: string, dayIso: string): number {
    return this.entries
      .filter((e) => e.userId === userId && e.ruleId === ruleId && e.occurredAt.startsWith(dayIso))
      .reduce((sum, e) => sum + e.points, 0);
  }
}

export class RuleConfig {
  readonly rules: PointRule[] = [
    { ruleId: 'course-completed', eventType: 'CourseCompleted', points: 100 },
    { ruleId: 'assessment-passed', eventType: 'AssessmentPassed', points: 50 },
    { ruleId: 'certification-earned', eventType: 'CertificationEarned', points: 300 },
    { ruleId: 'manager-recognition', eventType: 'ManagerRecognitionGiven', points: 200 },
  ];

  byEventType(eventType: EventType): PointRule[] {
    return this.rules.filter((r) => r.eventType === eventType);
  }

  update(ruleId: string, points: number, dailyCapPerUser?: number): boolean {
    const rule = this.rules.find((r) => r.ruleId === ruleId);
    if (!rule) return false;
    rule.points = points;
    rule.dailyCapPerUser = dailyCapPerUser;
    return true;
  }
}

export class AwardService {
  /** userId of event payloads awarded per event type. */
  constructor(
    private readonly ledger: PointLedger,
    private readonly config: RuleConfig,
    private readonly achievements: AchievementService,
    private readonly publisher: DomainEventPublisher,
    private readonly clock: ClockPort,
    private readonly ids: IdPort,
  ) {}

  award(eventType: EventType, userId: string, sourceEventId: string): void {
    for (const rule of this.config.byEventType(eventType)) {
      const occurredAt = this.clock.now().toISOString();
      if (rule.dailyCapPerUser !== undefined) {
        const today = occurredAt.slice(0, 10);
        if (this.ledger.awardedToday(userId, rule.ruleId, today) + rule.points > rule.dailyCapPerUser) {
          continue;
        }
      }
      const appended = this.ledger.append({
        entryId: this.ids.next(),
        userId,
        ruleId: rule.ruleId,
        points: rule.points,
        sourceEventId,
        occurredAt,
      });
      if (!appended) continue; // replay — idempotent
      this.publisher.publishPending('gamification', [
        {
          type: 'PointsAwarded',
          aggregateId: userId,
          payload: { userId, ruleId: rule.ruleId, points: rule.points, sourceEventId },
        },
      ]);
      this.achievements.evaluate(userId);
    }
  }
}

export class AchievementService {
  readonly achievements: Achievement[] = [
    { id: 'first-thousand', name: 'First 1000 Points', criterion: { kind: 'points-total', threshold: 1000 } },
    { id: 'first-course', name: 'First Course Completed', criterion: { kind: 'courses-completed', threshold: 1 } },
    { id: 'five-courses', name: 'Five Courses Completed', criterion: { kind: 'courses-completed', threshold: 5 } },
  ];
  private grants = new Map<string, Set<string>>();
  private coursesCompleted = new Map<string, number>();

  constructor(
    private readonly ledger: PointLedger,
    private readonly publisher: DomainEventPublisher,
  ) {}

  trackCourseCompleted(userId: string): void {
    this.coursesCompleted.set(userId, (this.coursesCompleted.get(userId) ?? 0) + 1);
    this.evaluate(userId);
  }

  /** Grants are once-only. */
  evaluate(userId: string): void {
    for (const achievement of this.achievements) {
      if (this.grants.get(userId)?.has(achievement.id)) continue;
      const { kind, threshold } = achievement.criterion;
      const value =
        kind === 'points-total'
          ? this.ledger.totalOf(userId)
          : (this.coursesCompleted.get(userId) ?? 0);
      if (value >= threshold) {
        if (!this.grants.has(userId)) this.grants.set(userId, new Set());
        this.grants.get(userId)!.add(achievement.id);
        this.publisher.publishPending('gamification', [
          { type: 'AchievementUnlocked', aggregateId: userId, payload: { userId, achievementId: achievement.id } },
        ]);
      }
    }
  }

  of(userId: string): Achievement[] {
    const ids = this.grants.get(userId) ?? new Set();
    return this.achievements.filter((a) => ids.has(a.id));
  }
}

export interface LeaderboardEntry {
  userId: string;
  points: number;
  rank: number;
}

/** Materialized periodically (worker job), never computed at read time. */
export class LeaderboardProjections {
  private boards = new Map<string, LeaderboardEntry[]>();

  constructor(
    private readonly ledger: PointLedger,
    private readonly clock: ClockPort,
    private readonly teamOf: (userId: string) => string | null,
  ) {}

  materialize(): void {
    this.boards.clear();
    const now = this.clock.now();
    for (const period of ['weekly', 'monthly', 'quarterly', 'annual'] as LeaderboardPeriod[]) {
      const since = periodStart(period, now);
      const totals = new Map<string, number>();
      for (const entry of this.ledger.all()) {
        if (new Date(entry.occurredAt) < since) continue;
        totals.set(entry.userId, (totals.get(entry.userId) ?? 0) + entry.points);
      }
      this.boards.set(`${period}|global`, rank(totals));
      const byTeam = new Map<string, Map<string, number>>();
      for (const [userId, points] of totals) {
        const team = this.teamOf(userId);
        if (!team) continue;
        if (!byTeam.has(team)) byTeam.set(team, new Map());
        byTeam.get(team)!.set(userId, points);
      }
      for (const [team, teamTotals] of byTeam) {
        this.boards.set(`${period}|team:${team}`, rank(teamTotals));
      }
    }
  }

  get(period: LeaderboardPeriod, scope: 'global' | 'team', teamRef?: string): LeaderboardEntry[] {
    const key = scope === 'global' ? `${period}|global` : `${period}|team:${teamRef}`;
    return this.boards.get(key) ?? [];
  }
}

/** Competition ranking: ties share rank, next rank skips. */
function rank(totals: Map<string, number>): LeaderboardEntry[] {
  const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  const entries: LeaderboardEntry[] = [];
  let lastPoints = Number.POSITIVE_INFINITY;
  let lastRank = 0;
  sorted.forEach(([userId, points], index) => {
    const rankValue = points === lastPoints ? lastRank : index + 1;
    entries.push({ userId, points, rank: rankValue });
    lastPoints = points;
    lastRank = rankValue;
  });
  return entries;
}

function periodStart(period: LeaderboardPeriod, now: Date): Date {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  switch (period) {
    case 'weekly': {
      const day = d.getUTCDay() || 7;
      d.setUTCDate(d.getUTCDate() - day + 1);
      return d;
    }
    case 'monthly':
      return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    case 'quarterly':
      return new Date(Date.UTC(now.getUTCFullYear(), Math.floor(now.getUTCMonth() / 3) * 3, 1));
    case 'annual':
      return new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  }
}

export class RecognitionHandler {
  constructor(
    private readonly publisher: DomainEventPublisher,
    private readonly isManagerOf: (managerId: string, userId: string) => boolean,
  ) {}

  execute(input: { userId: string; note?: string }, actor: AuthenticatedUser): Result<void> {
    const allowed =
      actor.role === 'admin' ||
      (actor.role === 'manager' && this.isManagerOf(actor.userId, input.userId));
    if (!allowed) return err('forbidden', 'Recognition is manager-of or admin only');
    this.publisher.publishPending('gamification', [
      {
        type: 'ManagerRecognitionGiven',
        aggregateId: input.userId,
        payload: { userId: input.userId, managerId: actor.userId, ...(input.note ? { note: input.note } : {}) },
      },
    ]);
    return ok(undefined);
  }
}

export class GamificationQueries {
  constructor(
    private readonly ledger: PointLedger,
    private readonly achievements: AchievementService,
    private readonly leaderboards: LeaderboardProjections,
  ) {}

  pointsOf(userId: string) {
    return { total: this.ledger.totalOf(userId), entries: this.ledger.of(userId) };
  }
  achievementsOf(userId: string) {
    return this.achievements.of(userId);
  }
  leaderboard(period: LeaderboardPeriod, scope: 'global' | 'team', teamRef?: string) {
    return this.leaderboards.get(period, scope, teamRef);
  }
}

export interface GamificationModule {
  ledger: PointLedger;
  rules: RuleConfig;
  recognition: RecognitionHandler;
  leaderboards: LeaderboardProjections;
  queries: GamificationQueries;
}

export function createGamificationModule(deps: {
  publisher: DomainEventPublisher;
  bus: InProcessEventBus;
  clock: ClockPort;
  ids: IdPort;
  isManagerOf: (managerId: string, userId: string) => boolean;
  teamOf: (userId: string) => string | null;
}): GamificationModule {
  const ledger = new PointLedger();
  const rules = new RuleConfig();
  const achievements = new AchievementService(ledger, deps.publisher);
  const awards = new AwardService(ledger, rules, achievements, deps.publisher, deps.clock, deps.ids);
  const leaderboards = new LeaderboardProjections(ledger, deps.clock, deps.teamOf);

  const subscriber: EventSubscriber = {
    name: 'gamification.award-points',
    eventTypes: ['CourseCompleted', 'AssessmentPassed', 'CertificationEarned', 'ManagerRecognitionGiven'],
    handle(event) {
      const userId = (event.payload as { userId: string }).userId;
      if (event.type === 'CourseCompleted') {
        achievements.trackCourseCompleted((event.payload as EventPayload<'CourseCompleted'>).userId);
      }
      awards.award(event.type, userId, event.id);
    },
  };
  deps.bus.subscribe(subscriber);

  return {
    ledger,
    rules,
    recognition: new RecognitionHandler(deps.publisher, deps.isManagerOf),
    leaderboards,
    queries: new GamificationQueries(ledger, achievements, leaderboards),
  };
}
