import { PlatformRole } from '@lms/contracts';

/** Central permission catalog (master plan §16) — permission-based, not role-based, checks. */
export const PERMISSIONS = [
  'users.read',
  'users.manage',
  'org.read',
  'org.manage',
  'catalog.read',
  'catalog.manage',
  'enrollment.assign',
  'assessment.take',
  'assessment.review',
  'assessment.manage',
  'evidence.submit',
  'evidence.review',
  'cert.read',
  'cert.manage',
  'promotion.read-self',
  'promotion.read-team',
  'requirement-sets.manage',
  'gamification.read',
  'gamification.recognize',
  'gamification.manage',
  'analytics.team',
  'analytics.global',
  'notifications.read-self',
  'notifications.manage-templates',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const employeePermissions: Permission[] = [
  'org.read',
  'catalog.read',
  'assessment.take',
  'evidence.submit',
  'cert.read',
  'promotion.read-self',
  'gamification.read',
  'notifications.read-self',
];

const managerPermissions: Permission[] = [
  ...employeePermissions,
  'users.read',
  'enrollment.assign',
  'assessment.review',
  'evidence.review',
  'promotion.read-team',
  'gamification.recognize',
  'analytics.team',
];

export const rolePermissions: Record<PlatformRole, readonly Permission[]> = {
  employee: employeePermissions,
  manager: managerPermissions,
  admin: PERMISSIONS,
};

export function hasPermission(role: PlatformRole, permission: Permission): boolean {
  return rolePermissions[role].includes(permission);
}
