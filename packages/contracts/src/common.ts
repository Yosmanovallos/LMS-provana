import { z } from 'zod';

export const platformRoleSchema = z.enum(['employee', 'manager', 'admin']);
export type PlatformRole = z.infer<typeof platformRoleSchema>;

/** Job role × level pair — the key referenced by study paths and requirement sets. */
export const roleLevelSchema = z.object({
  jobRoleId: z.string().min(1),
  jobLevelId: z.string().min(1),
});
export type RoleLevel = z.infer<typeof roleLevelSchema>;

export const enrollmentTargetKindSchema = z.enum(['course', 'program', 'path', 'assessment']);
export type EnrollmentTargetKind = z.infer<typeof enrollmentTargetKindSchema>;

export const certificationSourceSchema = z.enum(['assessment', 'course', 'evidence', 'manual']);
export type CertificationSource = z.infer<typeof certificationSourceSchema>;

export const notificationChannelSchema = z.enum(['email', 'in-app']);
export type NotificationChannel = z.infer<typeof notificationChannelSchema>;

export const leaderboardPeriodSchema = z.enum(['weekly', 'monthly', 'quarterly', 'annual']);
export type LeaderboardPeriod = z.infer<typeof leaderboardPeriodSchema>;
