import { EventPayload, NotificationChannel } from '@lms/contracts';
import { EmailPort } from '../../ports/email.port';
import { ClockPort, IdPort } from '../../ports/system.port';
import { EventSubscriber, InProcessEventBus } from '../shared-kernel/event-bus';
import { DomainEventPublisher } from '../shared-kernel/publisher';
import { Result, err, ok } from '../shared-kernel/result';

export interface NotificationTemplate {
  key: string;
  subject: string;
  body: string;
}

/** Handlebars-lite: {{var}} substitution only. */
export function render(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, name: string) => vars[name] ?? '');
}

export class TemplateStore {
  private templates = new Map<string, NotificationTemplate>();

  constructor() {
    const defaults: NotificationTemplate[] = [
      { key: 'assignment.new', subject: 'New learning assignment', body: 'You have been assigned: {{title}}. Due: {{dueDate}}.' },
      { key: 'evidence.submitted', subject: 'Evidence awaiting your review', body: '{{employeeName}} submitted evidence: {{description}}.' },
      { key: 'evidence.decided', subject: 'Your evidence was {{decision}}', body: 'Decision: {{decision}}. {{feedback}}' },
      { key: 'assessment.result', subject: 'Assessment result: {{result}}', body: 'You scored {{scorePct}}% — {{result}}.' },
      { key: 'promotion.eligible', subject: 'Promotion readiness reached 100%', body: '{{employeeName}} is eligible for promotion to {{target}}.' },
    ];
    for (const t of defaults) this.templates.set(t.key, t);
  }

  get(key: string): NotificationTemplate | null {
    return this.templates.get(key) ?? null;
  }
  upsert(template: NotificationTemplate): void {
    this.templates.set(template.key, template);
  }
  list(): NotificationTemplate[] {
    return [...this.templates.values()];
  }
}

export class PreferenceStore {
  private disabled = new Set<string>();

  /** Default: every channel enabled. */
  isEnabled(userId: string, channel: NotificationChannel): boolean {
    return !this.disabled.has(`${userId}|${channel}`);
  }
  set(userId: string, channel: NotificationChannel, enabled: boolean): void {
    const key = `${userId}|${channel}`;
    if (enabled) this.disabled.delete(key);
    else this.disabled.add(key);
  }
}

export interface DispatchRecord {
  id: string;
  eventType: string;
  userId: string;
  channel: NotificationChannel;
  templateKey: string;
  status: 'sent' | 'failed' | 'skipped';
  at: string;
  error?: string;
}

export interface InAppNotification {
  id: string;
  userId: string;
  title: string;
  body: string;
  createdAt: string;
  readAt: string | null;
}

export class NotificationService {
  readonly dispatchLog: DispatchRecord[] = [];
  private inbox = new Map<string, InAppNotification[]>();

  constructor(
    private readonly templates: TemplateStore,
    private readonly preferences: PreferenceStore,
    private readonly email: EmailPort,
    private readonly publisher: DomainEventPublisher,
    private readonly clock: ClockPort,
    private readonly ids: IdPort,
    private readonly emailOf: (userId: string) => string | null,
  ) {}

  /** Sends on both channels honoring preferences. Failures are recorded, never thrown. */
  notify(eventType: string, userId: string, templateKey: string, vars: Record<string, string>): void {
    const template = this.templates.get(templateKey);
    if (!template) return;
    const subject = render(template.subject, vars);
    const body = render(template.body, vars);

    for (const channel of ['email', 'in-app'] as NotificationChannel[]) {
      if (!this.preferences.isEnabled(userId, channel)) {
        this.record(eventType, userId, channel, templateKey, 'skipped');
        continue;
      }
      if (channel === 'email') {
        const to = this.emailOf(userId);
        const sent = to ? this.email.send({ to, subject, body }) : false;
        this.record(eventType, userId, channel, templateKey, sent ? 'sent' : 'failed', sent ? undefined : 'delivery failed');
        if (sent) this.publishSent(userId, channel, templateKey);
      } else {
        const list = this.inbox.get(userId) ?? [];
        list.push({
          id: this.ids.next(),
          userId,
          title: subject,
          body,
          createdAt: this.clock.now().toISOString(),
          readAt: null,
        });
        this.inbox.set(userId, list);
        this.record(eventType, userId, channel, templateKey, 'sent');
        this.publishSent(userId, channel, templateKey);
      }
    }
  }

  inboxOf(userId: string): InAppNotification[] {
    return [...(this.inbox.get(userId) ?? [])];
  }

  unreadCount(userId: string): number {
    return this.inboxOf(userId).filter((n) => !n.readAt).length;
  }

  markRead(userId: string, notificationId: string): Result<void> {
    const item = (this.inbox.get(userId) ?? []).find((n) => n.id === notificationId);
    if (!item) return err('not-found', 'Notification not found in your inbox');
    item.readAt = this.clock.now().toISOString();
    return ok(undefined);
  }

  private record(
    eventType: string,
    userId: string,
    channel: NotificationChannel,
    templateKey: string,
    status: DispatchRecord['status'],
    error?: string,
  ): void {
    this.dispatchLog.push({
      id: this.ids.next(),
      eventType,
      userId,
      channel,
      templateKey,
      status,
      at: this.clock.now().toISOString(),
      ...(error ? { error } : {}),
    });
  }

  private publishSent(userId: string, channel: NotificationChannel, templateKey: string): void {
    this.publisher.publishPending('notification', [
      { type: 'NotificationSent', aggregateId: userId, payload: { userId, channel, templateKey } },
    ]);
  }
}

/** Event → notification mapping table (docs/modules/notification.md). */
export function notificationSubscriber(
  service: NotificationService,
  managerOf: (userId: string) => string | null,
  displayNameOf: (userId: string) => string,
): EventSubscriber {
  return {
    name: 'notification.dispatch',
    eventTypes: [
      'EnrollmentCreated',
      'EvidenceSubmitted',
      'EvidenceApproved',
      'EvidenceRejected',
      'AssessmentPassed',
      'AssessmentFailed',
      'PromotionEligible',
    ],
    handle(event) {
      switch (event.type) {
        case 'EnrollmentCreated': {
          const p = event.payload as EventPayload<'EnrollmentCreated'>;
          if (p.source !== 'assigned') return;
          service.notify(event.type, p.userId, 'assignment.new', {
            title: p.targetId,
            dueDate: p.dueDate ?? 'n/a',
          });
          return;
        }
        case 'EvidenceSubmitted': {
          const p = event.payload as EventPayload<'EvidenceSubmitted'>;
          const manager = managerOf(p.userId);
          if (manager) {
            service.notify(event.type, manager, 'evidence.submitted', {
              employeeName: displayNameOf(p.userId),
              description: p.evidenceId,
            });
          }
          return;
        }
        case 'EvidenceApproved':
        case 'EvidenceRejected': {
          const p = event.payload as EventPayload<'EvidenceApproved' | 'EvidenceRejected'>;
          service.notify(event.type, p.userId, 'evidence.decided', {
            decision: event.type === 'EvidenceApproved' ? 'approved' : 'rejected',
            feedback: 'feedback' in p ? (p as { feedback: string }).feedback : '',
          });
          return;
        }
        case 'AssessmentPassed':
        case 'AssessmentFailed': {
          const p = event.payload as EventPayload<'AssessmentPassed'>;
          service.notify(event.type, p.userId, 'assessment.result', {
            result: event.type === 'AssessmentPassed' ? 'passed' : 'failed',
            scorePct: String(p.scorePct),
          });
          return;
        }
        case 'PromotionEligible': {
          const p = event.payload as EventPayload<'PromotionEligible'>;
          const vars = {
            employeeName: displayNameOf(p.userId),
            target: `${p.targetRoleLevel.jobRoleId} ${p.targetRoleLevel.jobLevelId}`,
          };
          service.notify(event.type, p.userId, 'promotion.eligible', vars);
          const manager = managerOf(p.userId);
          if (manager) service.notify(event.type, manager, 'promotion.eligible', vars);
          return;
        }
      }
    },
  };
}

export interface NotificationModule {
  service: NotificationService;
  templates: TemplateStore;
  preferences: PreferenceStore;
}

export function createNotificationModule(deps: {
  publisher: DomainEventPublisher;
  bus: InProcessEventBus;
  clock: ClockPort;
  ids: IdPort;
  email: EmailPort;
  emailOf: (userId: string) => string | null;
  managerOf: (userId: string) => string | null;
  displayNameOf: (userId: string) => string;
}): NotificationModule {
  const templates = new TemplateStore();
  const preferences = new PreferenceStore();
  const service = new NotificationService(
    templates,
    preferences,
    deps.email,
    deps.publisher,
    deps.clock,
    deps.ids,
    deps.emailOf,
  );
  deps.bus.subscribe(notificationSubscriber(service, deps.managerOf, deps.displayNameOf));
  return { service, templates, preferences };
}
