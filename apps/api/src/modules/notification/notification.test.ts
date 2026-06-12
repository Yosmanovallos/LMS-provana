import { describe, expect, it } from 'vitest';
import { ConsoleEmailAdapter } from '../../adapters/console-email.adapter';
import { unwrap } from '../shared-kernel/result';
import { createTestKernel } from '../shared-kernel/testing';
import { createNotificationModule, render } from './notification.module';

function setup() {
  const kernel = createTestKernel();
  const email = new ConsoleEmailAdapter();
  const notification = createNotificationModule({
    ...kernel,
    email,
    emailOf: (id) => (id === 'ghost' ? null : `${id}@x.co`),
    managerOf: (id) => (id === 'u-1' ? 'mgr-1' : null),
    displayNameOf: (id) => id.toUpperCase(),
  });
  return { kernel, email, notification };
}

describe('templates', () => {
  it('substitutes {{vars}} and leaves unknown vars empty', () => {
    expect(render('Hello {{name}}, due {{dueDate}}', { name: 'Ana' })).toBe('Hello Ana, due ');
  });
});

describe('event → notification mapping', () => {
  it('assigned enrollment notifies the learner on both channels; self-enrollment does not', () => {
    const { kernel, email, notification } = setup();
    kernel.publisher.publishPending('learning', [
      { type: 'EnrollmentCreated', aggregateId: 'e1', payload: { enrollmentId: 'e1', userId: 'u-1', targetKind: 'course', targetId: 'c-1', source: 'assigned', assignedBy: 'mgr-1', dueDate: '2026-07-01' } },
      { type: 'EnrollmentCreated', aggregateId: 'e2', payload: { enrollmentId: 'e2', userId: 'u-1', targetKind: 'course', targetId: 'c-2', source: 'self' } },
    ]);
    expect(email.sent).toHaveLength(1);
    expect(email.sent[0]!.to).toBe('u-1@x.co');
    expect(notification.service.inboxOf('u-1')).toHaveLength(1);
    expect(notification.service.unreadCount('u-1')).toBe(1);
    expect(kernel.outbox.all().filter((e) => e.type === 'NotificationSent')).toHaveLength(2);
  });

  it('evidence submitted notifies the manager; decision notifies the learner with feedback', () => {
    const { email, kernel, notification } = setup();
    kernel.publisher.publishPending('evidence', [
      { type: 'EvidenceSubmitted', aggregateId: 'ev1', payload: { evidenceId: 'ev1', userId: 'u-1' } },
      { type: 'EvidenceRejected', aggregateId: 'ev1', payload: { evidenceId: 'ev1', userId: 'u-1', reviewerId: 'mgr-1', feedback: 'Blurry' } },
    ]);
    expect(notification.service.inboxOf('mgr-1')).toHaveLength(1);
    const learnerInbox = notification.service.inboxOf('u-1');
    expect(learnerInbox).toHaveLength(1);
    expect(learnerInbox[0]!.title).toContain('rejected');
    expect(learnerInbox[0]!.body).toContain('Blurry');
    expect(email.sent.map((e) => e.to).sort()).toEqual(['mgr-1@x.co', 'u-1@x.co']);
  });

  it('assessment results and promotion eligibility (learner + manager) are delivered', () => {
    const { notification, kernel } = setup();
    kernel.publisher.publishPending('assessment', [
      { type: 'AssessmentFailed', aggregateId: 'a1', payload: { userId: 'u-1', assessmentId: 'as', attemptId: 'a1', scorePct: 40 } },
    ]);
    kernel.publisher.publishPending('promotion', [
      { type: 'PromotionEligible', aggregateId: 'u-1', payload: { userId: 'u-1', targetRoleLevel: { jobRoleId: 'qa', jobLevelId: 'mid' }, requirementSetVersion: 1 } },
    ]);
    expect(notification.service.inboxOf('u-1').map((n) => n.title)).toEqual([
      'Assessment result: failed',
      'Promotion readiness reached 100%',
    ]);
    expect(notification.service.inboxOf('mgr-1').map((n) => n.body)).toEqual([
      'U-1 is eligible for promotion to qa mid.',
    ]);
  });
});

describe('preferences, failures, inbox', () => {
  it('disabled channel produces a skipped record, not a silent drop', () => {
    const { email, kernel, notification } = setup();
    notification.preferences.set('u-1', 'email', false);
    kernel.publisher.publishPending('assessment', [
      { type: 'AssessmentPassed', aggregateId: 'a1', payload: { userId: 'u-1', assessmentId: 'as', attemptId: 'a1', scorePct: 90 } },
    ]);
    expect(email.sent).toHaveLength(0);
    const records = notification.service.dispatchLog.filter((r) => r.userId === 'u-1');
    expect(records.map((r) => `${r.channel}:${r.status}`).sort()).toEqual(['email:skipped', 'in-app:sent']);
  });

  it('email provider failure is recorded as failed and does not throw into the consumer', () => {
    const { email, kernel, notification } = setup();
    email.failNext = true;
    kernel.publisher.publishPending('assessment', [
      { type: 'AssessmentPassed', aggregateId: 'a1', payload: { userId: 'u-1', assessmentId: 'as', attemptId: 'a1', scorePct: 90 } },
    ]);
    expect(notification.service.dispatchLog.find((r) => r.channel === 'email')!.status).toBe('failed');
    expect(notification.service.inboxOf('u-1')).toHaveLength(1); // in-app still delivered
  });

  it('markRead is owner-only and updates unread count', () => {
    const { kernel, notification } = setup();
    kernel.publisher.publishPending('assessment', [
      { type: 'AssessmentPassed', aggregateId: 'a1', payload: { userId: 'u-1', assessmentId: 'as', attemptId: 'a1', scorePct: 90 } },
    ]);
    const note = notification.service.inboxOf('u-1')[0]!;
    expect(notification.service.markRead('someone-else', note.id).ok).toBe(false);
    unwrap(notification.service.markRead('u-1', note.id));
    expect(notification.service.unreadCount('u-1')).toBe(0);
  });
});
