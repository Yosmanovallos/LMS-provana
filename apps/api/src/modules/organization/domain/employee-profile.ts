import { AggregateRoot } from '../../shared-kernel/aggregate-root';
import { Result, err, ok } from '../../shared-kernel/result';

export interface LevelChange {
  jobRoleId: string;
  fromLevelId: string | null;
  toLevelId: string;
  changedBy: string;
  at: string;
}

export class EmployeeProfile extends AggregateRoot {
  managerId: string | null = null;
  teamId: string | null = null;
  departmentId: string | null = null;
  jobRoleId: string | null = null;
  jobLevelId: string | null = null;
  /** Append-only — never rewritten. */
  readonly levelHistory: LevelChange[] = [];
  /** Start of tenure at the current level (TenureRequirement input). */
  currentLevelSince: string | null = null;

  constructor(
    public readonly userId: string,
    public displayName: string,
  ) {
    super();
  }

  assignManager(managerId: string, assignedBy: string): Result<void> {
    if (managerId === this.userId) return err('validation', 'Cannot be own manager');
    this.managerId = managerId;
    this.recordEvent('EmployeeAssignedToManager', this.userId, {
      userId: this.userId,
      managerId,
      assignedBy,
    });
    return ok(undefined);
  }

  changeJobLevel(jobRoleId: string, toLevelId: string, changedBy: string, at: Date): Result<void> {
    const fromLevelId = this.jobRoleId === jobRoleId ? this.jobLevelId : null;
    if (fromLevelId === toLevelId) return err('validation', 'Already at that level');
    this.jobRoleId = jobRoleId;
    this.jobLevelId = toLevelId;
    this.currentLevelSince = at.toISOString();
    this.levelHistory.push({
      jobRoleId,
      fromLevelId,
      toLevelId,
      changedBy,
      at: at.toISOString(),
    });
    this.recordEvent('JobLevelChanged', this.userId, {
      userId: this.userId,
      jobRoleId,
      fromLevelId,
      toLevelId,
      changedBy,
    });
    return ok(undefined);
  }

  assignTeam(teamId: string | null, departmentId: string | null): void {
    this.teamId = teamId;
    this.departmentId = departmentId;
  }
}
