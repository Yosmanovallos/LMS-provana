import { describe, expect, it } from 'vitest';
import { unwrap } from '../shared-kernel/result';
import { createTestKernel } from '../shared-kernel/testing';
import { createCertificationModule } from './certification.module';

const admin = { userId: 'admin-1', role: 'admin' as const };

function setup() {
  const kernel = createTestKernel();
  const certs = createCertificationModule(kernel);
  return { kernel, certs };
}

describe('certification', () => {
  it('issues on AssessmentPassed for configured certifying assessments, idempotently', () => {
    const { kernel, certs } = setup();
    certs.config.assessments.set('as-1', { name: 'ISTQB Foundation' });
    const passed = {
      type: 'AssessmentPassed' as const,
      aggregateId: 'att-1',
      payload: { userId: 'u-1', assessmentId: 'as-1', attemptId: 'att-1', scorePct: 90 },
    };
    kernel.publisher.publishPending('assessment', [passed]);
    kernel.publisher.publishPending('assessment', [passed]); // replay
    // a second pass attempt (new event id) must also not duplicate (repo idempotency)
    kernel.publisher.publishPending('assessment', [
      { ...passed, payload: { ...passed.payload, attemptId: 'att-2' } },
    ]);

    const list = certs.queries.listForUser('u-1');
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ name: 'ISTQB Foundation', source: 'assessment', status: 'valid' });
    expect(kernel.outbox.all().filter((e) => e.type === 'CertificationEarned')).toHaveLength(1);
  });

  it('does not issue for unconfigured sources; issues on certifying course completion', () => {
    const { kernel, certs } = setup();
    certs.config.courses.set('c-1', { name: 'Automation Fundamentals Cert' });
    kernel.publisher.publishPending('assessment', [
      {
        type: 'AssessmentPassed',
        aggregateId: 'a',
        payload: { userId: 'u-1', assessmentId: 'unconfigured', attemptId: 'a', scorePct: 80 },
      },
    ]);
    kernel.publisher.publishPending('learning', [
      {
        type: 'CourseCompleted',
        aggregateId: 'e',
        payload: { userId: 'u-1', enrollmentId: 'e', courseId: 'c-1' },
      },
    ]);
    expect(certs.queries.listForUser('u-1').map((c) => c.name)).toEqual(['Automation Fundamentals Cert']);
  });

  it('manual issuance is admin-only; expiry transitions exactly once and publishes', () => {
    const { kernel, certs } = setup();
    expect(certs.issueManual.execute({ userId: 'u-1', name: 'AWS SAA' }, { userId: 'u', role: 'employee' }).ok).toBe(false);
    unwrap(certs.issueManual.execute({ userId: 'u-1', name: 'AWS SAA', validMonths: 1 }, admin));

    kernel.clock.advanceDays(45);
    expect(certs.service.expireDue()).toBe(1);
    expect(certs.service.expireDue()).toBe(0); // exactly once
    expect(certs.queries.listForUser('u-1')[0]!.status).toBe('expired');
    expect(kernel.outbox.all().filter((e) => e.type === 'CertificationExpired')).toHaveLength(1);
    expect(certs.queries.validNamesOf('u-1')).toEqual([]);
  });

  it('issues from approved evidence targeting a certification requirement', () => {
    const { kernel, certs } = setup();
    certs.config.evidenceRequirements.set('req-cert-b', { name: 'Certification B' });
    kernel.publisher.publishPending('evidence', [
      {
        type: 'EvidenceApproved',
        aggregateId: 'ev-1',
        payload: { evidenceId: 'ev-1', userId: 'u-1', targetRequirementId: 'req-cert-b', reviewerId: 'm-1' },
      },
    ]);
    expect(certs.queries.validNamesOf('u-1')).toEqual(['Certification B']);
  });
});
