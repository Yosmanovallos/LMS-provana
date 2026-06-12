import { describe, expect, it } from 'vitest';
import {
  EventPayload,
  EventType,
  eventTypes,
  validateEventPayload,
} from '../src';

const samples: { [T in EventType]: EventPayload<T> } = {
  UserRegistered: { userId: 'u1', email: 'a@b.co', displayName: 'Ana', role: 'employee' },
  RoleAssigned: { userId: 'u1', role: 'manager', assignedBy: 'admin1' },
  EmployeeAssignedToManager: { userId: 'u1', managerId: 'm1', assignedBy: 'admin1' },
  JobLevelChanged: {
    userId: 'u1', jobRoleId: 'qa', fromLevelId: 'junior', toLevelId: 'mid', changedBy: 'admin1',
  },
  EnrollmentCreated: {
    enrollmentId: 'e1', userId: 'u1', targetKind: 'course', targetId: 'c1', source: 'assigned',
    assignedBy: 'm1',
  },
  LessonCompleted: { userId: 'u1', enrollmentId: 'e1', courseId: 'c1', lessonId: 'l1' },
  CourseCompleted: { userId: 'u1', enrollmentId: 'e1', courseId: 'c1' },
  PathCompleted: { userId: 'u1', pathId: 'p1' },
  AttemptSubmitted: { attemptId: 'a1', userId: 'u1', assessmentId: 'as1' },
  AssessmentPassed: { userId: 'u1', assessmentId: 'as1', attemptId: 'a1', scorePct: 85 },
  AssessmentFailed: { userId: 'u1', assessmentId: 'as1', attemptId: 'a1', scorePct: 40 },
  EvidenceSubmitted: { evidenceId: 'ev1', userId: 'u1', targetRequirementId: 'r1' },
  EvidenceApproved: { evidenceId: 'ev1', userId: 'u1', reviewerId: 'm1' },
  EvidenceRejected: { evidenceId: 'ev1', userId: 'u1', reviewerId: 'm1', feedback: 'Blurry scan' },
  CertificationEarned: {
    certificationId: 'ct1', userId: 'u1', name: 'ISTQB', source: 'assessment', sourceRefId: 'as1',
  },
  CertificationExpired: { certificationId: 'ct1', userId: 'u1', name: 'ISTQB' },
  ReadinessRecalculated: { userId: 'u1', snapshotId: 's1', percentReady: 82 },
  PromotionEligible: {
    userId: 'u1', targetRoleLevel: { jobRoleId: 'qa', jobLevelId: 'mid' },
    requirementSetVersion: 2,
  },
  PointsAwarded: { userId: 'u1', ruleId: 'course-completed', points: 100, sourceEventId: 'evt1' },
  AchievementUnlocked: { userId: 'u1', achievementId: 'first-course' },
  ManagerRecognitionGiven: { userId: 'u1', managerId: 'm1', note: 'Great quarter' },
  NotificationSent: { userId: 'u1', channel: 'email', templateKey: 'assignment.new' },
};

describe('event payload contracts', () => {
  it('covers the full catalog (22 events)', () => {
    expect(eventTypes).toHaveLength(22);
  });

  it.each(eventTypes)('%s accepts its documented sample payload', (type) => {
    expect(validateEventPayload(type, samples[type])).toEqual({ ok: true });
  });

  it('rejects malformed payloads', () => {
    expect(validateEventPayload('UserRegistered', { userId: 'u1' }).ok).toBe(false);
    expect(
      validateEventPayload('EvidenceRejected', {
        evidenceId: 'ev1', userId: 'u1', reviewerId: 'm1', feedback: '',
      }).ok,
    ).toBe(false);
    expect(
      validateEventPayload('AssessmentPassed', {
        userId: 'u1', assessmentId: 'as1', attemptId: 'a1', scorePct: 140,
      }).ok,
    ).toBe(false);
  });

  it('rejects unknown event types', () => {
    expect(validateEventPayload('NotARealEvent', {}).ok).toBe(false);
  });
});
