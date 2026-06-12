import { ProfileRepository, TaxonomyStore, InMemoryTeamRepository } from './organization.repositories';
import { LevelChange } from './domain/employee-profile';

export interface ProfileView {
  userId: string;
  displayName: string;
  managerId: string | null;
  teamId: string | null;
  departmentId: string | null;
  jobRoleId: string | null;
  jobLevelId: string | null;
  currentLevelSince: string | null;
  levelHistory: LevelChange[];
}

export class OrganizationQueries {
  constructor(
    private readonly profiles: ProfileRepository,
    private readonly taxonomy: TaxonomyStore,
    private readonly teams: InMemoryTeamRepository,
  ) {}

  getProfile(userId: string): ProfileView | null {
    const p = this.profiles.byUserId(userId);
    return p ? this.toView(p) : null;
  }

  /** THE manager-scope primitive: profiles managed by the given manager. */
  getTeamMembers(managerId: string): ProfileView[] {
    return this.profiles.byManagerId(managerId).map((p) => this.toView(p));
  }

  isManagerOf(managerId: string, userId: string): boolean {
    return this.profiles.byUserId(userId)?.managerId === managerId;
  }

  listProfiles(): ProfileView[] {
    return this.profiles.list().map((p) => this.toView(p));
  }

  listRoleLevels() {
    return { roles: this.taxonomy.roles, levels: this.taxonomy.levels };
  }

  listTeams() {
    return this.teams.list();
  }

  private toView(p: NonNullable<ReturnType<ProfileRepository['byUserId']>>): ProfileView {
    return {
      userId: p.userId,
      displayName: p.displayName,
      managerId: p.managerId,
      teamId: p.teamId,
      departmentId: p.departmentId,
      jobRoleId: p.jobRoleId,
      jobLevelId: p.jobLevelId,
      currentLevelSince: p.currentLevelSince,
      levelHistory: [...p.levelHistory],
    };
  }
}
