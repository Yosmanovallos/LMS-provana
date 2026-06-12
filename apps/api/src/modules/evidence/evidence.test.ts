import { describe, expect, it } from 'vitest';
import { LocalFileStorageAdapter } from '../../adapters/local-file-storage.adapter';
import { AuthenticatedUser } from '../../ports/auth.port';
import { unwrap } from '../shared-kernel/result';
import { createTestKernel } from '../shared-kernel/testing';
import { createEvidenceModule } from './evidence.module';

const learner: AuthenticatedUser = { userId: 'u-1', role: 'employee' };
const manager: AuthenticatedUser = { userId: 'mgr-1', role: 'manager' };
const otherManager: AuthenticatedUser = { userId: 'mgr-2', role: 'manager' };
const admin: AuthenticatedUser = { userId: 'admin-1', role: 'admin' };

const pdf = { fileName: 'cert.pdf', mime: 'application/pdf', sizeBytes: 1024, content: 'x' };

function setup() {
  const kernel = createTestKernel();
  const evidence = createEvidenceModule({
    ...kernel,
    storage: new LocalFileStorageAdapter(kernel.ids),
    isManagerOf: (m, u) => m === 'mgr-1' && u === 'u-1',
  });
  return { kernel, evidence };
}

describe('evidence lifecycle', () => {
  it('submit → under-review → approved, full history retained, events published', () => {
    const { kernel, evidence } = setup();
    const { evidenceId } = unwrap(
      evidence.submit.execute({ file: pdf, description: 'ISTQB certificate', targetRequirementId: 'req-1' }, learner),
    );
    unwrap(evidence.review.startReview({ evidenceId }, manager));
    unwrap(evidence.review.approve({ evidenceId, note: 'Verified' }, manager));

    const view = unwrap(evidence.queries.getItem(evidenceId, learner));
    expect(view.status).toBe('approved');
    expect(view.history.map((h) => h.to)).toEqual(['submitted', 'under-review', 'approved']);
    expect(kernel.outbox.all().map((e) => e.type)).toEqual(['EvidenceSubmitted', 'EvidenceApproved']);
    const approved = kernel.outbox.all()[1]!;
    expect(approved.payload).toMatchObject({ targetRequirementId: 'req-1', reviewerId: 'mgr-1' });
  });

  it('rejection requires feedback; approved items are immutable', () => {
    const { evidence } = setup();
    const { evidenceId } = unwrap(evidence.submit.execute({ file: pdf, description: 'Doc' }, learner));
    expect(evidence.review.reject({ evidenceId, feedback: '  ' }, manager).ok).toBe(false);
    unwrap(evidence.review.approve({ evidenceId }, manager));
    expect(evidence.review.reject({ evidenceId, feedback: 'changed my mind' }, manager).ok).toBe(false);
    expect(evidence.review.approve({ evidenceId }, admin).ok).toBe(false); // no double-approve
  });

  it('only the assigned manager or admin reviews; visibility is owner/manager/admin', () => {
    const { evidence } = setup();
    const { evidenceId } = unwrap(evidence.submit.execute({ file: pdf, description: 'Doc' }, learner));

    expect(evidence.review.approve({ evidenceId }, otherManager).ok).toBe(false);
    expect(evidence.review.approve({ evidenceId }, learner).ok).toBe(false);

    expect(unwrap(evidence.queries.getItem(evidenceId, learner)).evidenceId).toBe(evidenceId);
    expect(unwrap(evidence.queries.getItem(evidenceId, manager)).evidenceId).toBe(evidenceId);
    expect(unwrap(evidence.queries.getItem(evidenceId, admin)).evidenceId).toBe(evidenceId);
    expect(evidence.queries.getItem(evidenceId, otherManager).ok).toBe(false);
    expect(evidence.queries.getItem(evidenceId, { userId: 'u-2', role: 'employee' }).ok).toBe(false);

    // queue scoping
    expect(evidence.queries.reviewQueue(manager)).toHaveLength(1);
    expect(evidence.queries.reviewQueue(otherManager)).toHaveLength(0);
    expect(evidence.queries.reviewQueue(admin)).toHaveLength(1);

    // admin can decide even without manager link
    expect(evidence.review.approve({ evidenceId }, admin).ok).toBe(true);
  });

  it('rejected evidence can be resubmitted as a NEW linked item; non-rejected cannot', () => {
    const { evidence } = setup();
    const { evidenceId } = unwrap(evidence.submit.execute({ file: pdf, description: 'v1' }, learner));

    const early = evidence.submit.execute(
      { file: pdf, description: 'v2', resubmissionOf: evidenceId },
      learner,
    );
    expect(early.ok).toBe(false); // not rejected yet

    unwrap(evidence.review.reject({ evidenceId, feedback: 'Wrong document' }, manager));
    const resub = unwrap(
      evidence.submit.execute({ file: pdf, description: 'v2', resubmissionOf: evidenceId }, learner),
    );
    const view = unwrap(evidence.queries.getItem(resub.evidenceId, learner));
    expect(view.resubmissionOf).toBe(evidenceId);
    expect(view.status).toBe('submitted'); // fresh lifecycle

    const foreign = evidence.submit.execute(
      { file: pdf, description: 'x', resubmissionOf: evidenceId },
      { userId: 'u-2', role: 'employee' },
    );
    expect(foreign.ok).toBe(false);
  });

  it('upload validation: mime allow-list and size bounds', () => {
    const { evidence } = setup();
    expect(
      evidence.submit.execute(
        { file: { fileName: 'a.exe', mime: 'application/x-msdownload', sizeBytes: 10 }, description: 'D' },
        learner,
      ).ok,
    ).toBe(false);
    expect(
      evidence.submit.execute(
        { file: { fileName: 'big.pdf', mime: 'application/pdf', sizeBytes: 99 * 1024 * 1024 }, description: 'D' },
        learner,
      ).ok,
    ).toBe(false);
  });
});
