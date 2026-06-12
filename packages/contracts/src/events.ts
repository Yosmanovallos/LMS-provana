import { z } from 'zod';
import {
  certificationSourceSchema,
  enrollmentTargetKindSchema,
  notificationChannelSchema,
  platformRoleSchema,
  roleLevelSchema,
} from './common';

const id = z.string().min(1);

/**
 * The domain-event catalog (master plan §8). Versioned contract spine: publishers validate
 * payloads against these schemas when appending to the outbox.
 */
export const eventPayloadSchemas = {
  // identity
  UserRegistered: z.object({
    userId: id,
    email: z.string().email(),
    displayName: z.string().min(1),
    role: platformRoleSchema,
  }),
  RoleAssigned: z.object({ userId: id, role: platformRoleSchema, assignedBy: id }),

  // organization
  EmployeeAssignedToManager: z.object({ userId: id, managerId: id, assignedBy: id }),
  JobLevelChanged: z.object({
    userId: id,
    jobRoleId: id,
    fromLevelId: id.nullable(),
    toLevelId: id,
    changedBy: id,
  }),

  // learning
  EnrollmentCreated: z.object({
    enrollmentId: id,
    userId: id,
    targetKind: enrollmentTargetKindSchema,
    targetId: id,
    source: z.enum(['assigned', 'self']),
    assignedBy: id.optional(),
    dueDate: z.string().optional(),
  }),
  LessonCompleted: z.object({ userId: id, enrollmentId: id, courseId: id, lessonId: id }),
  CourseCompleted: z.object({ userId: id, enrollmentId: id, courseId: id }),
  PathCompleted: z.object({ userId: id, pathId: id }),

  // assessment
  AttemptSubmitted: z.object({ attemptId: id, userId: id, assessmentId: id }),
  AssessmentPassed: z.object({
    userId: id,
    assessmentId: id,
    attemptId: id,
    scorePct: z.number().min(0).max(100),
  }),
  AssessmentFailed: z.object({
    userId: id,
    assessmentId: id,
    attemptId: id,
    scorePct: z.number().min(0).max(100),
  }),

  // evidence
  EvidenceSubmitted: z.object({
    evidenceId: id,
    userId: id,
    targetRequirementId: id.optional(),
  }),
  EvidenceApproved: z.object({
    evidenceId: id,
    userId: id,
    targetRequirementId: id.optional(),
    reviewerId: id,
  }),
  EvidenceRejected: z.object({
    evidenceId: id,
    userId: id,
    reviewerId: id,
    feedback: z.string().min(1),
  }),

  // certification
  CertificationEarned: z.object({
    certificationId: id,
    userId: id,
    name: z.string().min(1),
    source: certificationSourceSchema,
    sourceRefId: id.optional(),
  }),
  CertificationExpired: z.object({ certificationId: id, userId: id, name: z.string().min(1) }),

  // promotion
  ReadinessRecalculated: z.object({
    userId: id,
    snapshotId: id,
    percentReady: z.number().min(0).max(100),
  }),
  PromotionEligible: z.object({
    userId: id,
    targetRoleLevel: roleLevelSchema,
    requirementSetVersion: z.number().int().positive(),
  }),

  // gamification
  PointsAwarded: z.object({
    userId: id,
    ruleId: id,
    points: z.number().int(),
    sourceEventId: id,
  }),
  AchievementUnlocked: z.object({ userId: id, achievementId: id }),
  ManagerRecognitionGiven: z.object({ userId: id, managerId: id, note: z.string().optional() }),

  // notification
  NotificationSent: z.object({
    userId: id,
    channel: notificationChannelSchema,
    templateKey: z.string().min(1),
  }),
} as const;

export type EventType = keyof typeof eventPayloadSchemas;
export type EventPayload<T extends EventType> = z.infer<(typeof eventPayloadSchemas)[T]>;

export const eventTypes = Object.keys(eventPayloadSchemas) as EventType[];

/** Persisted/transported form of a domain event (outbox row / bus message). */
export interface DomainEventRecord<T extends EventType = EventType> {
  /** Unique event id — consumers use it as the idempotency key (`sourceEventId`). */
  id: string;
  type: T;
  /** Publishing bounded context, e.g. "learning". */
  context: string;
  aggregateId: string;
  /** ISO-8601 */
  occurredAt: string;
  payload: EventPayload<T>;
}

export function validateEventPayload(type: string, payload: unknown):
  | { ok: true }
  | { ok: false; error: string } {
  const schema = (eventPayloadSchemas as Record<string, z.ZodTypeAny>)[type];
  if (!schema) return { ok: false, error: `Unknown event type: ${type}` };
  const result = schema.safeParse(payload);
  return result.success ? { ok: true } : { ok: false, error: result.error.message };
}
