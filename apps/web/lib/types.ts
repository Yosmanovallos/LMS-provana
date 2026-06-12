/** Serialized shapes of the API's public query services and controllers. */

export type PlatformRole = 'employee' | 'manager' | 'admin';

export interface Persona {
  userId: string;
  role: PlatformRole;
  displayName: string;
}

export interface UserView {
  id: string;
  email: string;
  displayName: string;
  role: PlatformRole;
  status: string;
}

export interface ProfileView {
  userId: string;
  displayName: string;
  managerId: string | null;
  teamId: string | null;
  departmentId: string | null;
  jobRoleId: string | null;
  jobLevelId: string | null;
  currentLevelSince: string | null;
  levelHistory: { fromLevelId: string | null; toLevelId: string; changedAt: string }[];
}

export interface MeView extends Persona {
  user: UserView | null;
  profile: ProfileView | null;
  unreadNotifications: number;
}

export interface Taxonomy {
  roles: { id: string; name: string }[];
  levels: { id: string; name: string; rank: number }[];
}

// learning
export interface Lesson {
  id: string;
  title: string;
  type: 'video' | 'reading' | 'exercise';
  durationMin: number;
}

export interface CourseView {
  id: string;
  title: string;
  status: 'draft' | 'published' | 'archived';
  version: number;
  completionRule: string;
  modules: { id: string; title: string; lessons: Lesson[] }[];
}

export interface PathView {
  id: string;
  title: string;
  status: string;
  targetRoleLevel: { jobRoleId: string; jobLevelId: string } | null;
  items: { kind: string; refId: string }[];
}

export interface ProgramView {
  id: string;
  title: string;
  courseIds: string[];
}

export interface CatalogView {
  courses: CourseView[];
  paths: PathView[];
  programs: ProgramView[];
}

export interface EnrollmentView {
  enrollmentId: string;
  targetKind: string;
  targetId: string;
  title: string;
  status: string;
  percentComplete: number;
  dueDate: string | null;
  completedAt: string | null;
  source: string;
  completedLessonIds: string[];
}

export interface MyLearningView {
  todo: EnrollmentView[];
  active: EnrollmentView[];
  completed: EnrollmentView[];
}

// assessment
export type QuestionView =
  | { id: string; kind: 'multiple-choice'; prompt: string; options: string[]; points: number }
  | { id: string; kind: 'open-text'; prompt: string; points: number }
  | { id: string; kind: 'practical'; prompt: string; points: number };

export interface AssessmentView {
  id: string;
  title: string;
  status: string;
  questions: QuestionView[];
  passingScorePct: number;
  maxAttempts: number;
}

export interface AttemptView {
  attemptId: string;
  userId: string;
  assessmentId: string;
  assessmentTitle: string;
  status: 'in-progress' | 'awaiting-review' | 'passed' | 'failed';
  scorePct: number | null;
  feedback: string | null;
  answers: { questionId: string; value: number[] | string }[];
}

// evidence
export interface EvidenceView {
  evidenceId: string;
  userId: string;
  description: string;
  status: 'submitted' | 'under-review' | 'approved' | 'rejected';
  targetRequirementId: string | null;
  resubmissionOf: string | null;
  feedback: string | null;
  reviewerId: string | null;
  decidedAt: string | null;
  file: { storageKey: string; mime: string; sizeBytes: number };
  history: { from: string | null; to: string; actorId: string; at: string }[];
}

// certification
export interface CertificationView {
  certificationId: string;
  userId: string;
  name: string;
  type: string;
  source: string;
  status: 'valid' | 'expired' | 'revoked';
  issuedAt: string;
  expiresAt: string | null;
}

// promotion
export interface RequirementView {
  label: string;
  kind: string;
  weight: number;
}

export interface GapReport {
  userId: string;
  targetRoleLevel: { jobRoleId: string; jobLevelId: string };
  requirementSetVersion: number;
  percentReady: number;
  missing: RequirementView[];
  satisfied: RequirementView[];
  computedAt: string;
}

export interface TeamReadinessRow {
  userId: string;
  percentReady: number | null;
  targetRoleLevel: { jobRoleId: string; jobLevelId: string } | null;
  pendingItems: number | null;
}

export interface RequirementSetView {
  id: string;
  lineageId: string;
  fromRoleLevel: { jobRoleId: string; jobLevelId: string };
  toRoleLevel: { jobRoleId: string; jobLevelId: string };
  version: number;
  status: 'draft' | 'active' | 'superseded';
  effectiveFrom: string;
  requirements: ({ id: string; label: string; weight: number; kind: string } & Record<string, unknown>)[];
}

// gamification
export interface PointsView {
  total: number;
  entries: { entryId: string; ruleId: string; points: number; occurredAt: string }[];
}

export interface AchievementView {
  id: string;
  name: string;
  criterion: { kind: string; threshold: number };
}

export interface LeaderboardEntry {
  userId: string;
  points: number;
  rank: number;
}

export interface PointRuleView {
  ruleId: string;
  eventType: string;
  points: number;
  dailyCapPerUser?: number;
}

// analytics
export interface AnalyticsViews {
  completionRate: { managerId: string; enrolled: number; completed: number; ratePct: number }[];
  velocity: { week: string; completions: number }[];
  activeLearners: { week: string; count: number }[];
  teamProgress: { userId: string; enrolled: number; completed: number }[];
  readinessDistribution: { bucket: string; count: number }[];
}

// notification
export interface InAppNotification {
  id: string;
  userId: string;
  title: string;
  body: string;
  createdAt: string;
  readAt: string | null;
}

// infra / audit
export interface DomainEventRecord {
  id: string;
  type: string;
  context: string;
  aggregateId: string;
  occurredAt: string;
  payload: Record<string, unknown>;
}
