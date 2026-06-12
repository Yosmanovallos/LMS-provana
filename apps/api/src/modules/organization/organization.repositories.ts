import { EmployeeProfile } from './domain/employee-profile';

export interface Team {
  id: string;
  name: string;
  departmentId: string | null;
}

export interface JobRole {
  id: string;
  name: string;
}

export interface JobLevel {
  id: string;
  name: string;
  rank: number;
}

export interface ProfileRepository {
  byUserId(userId: string): EmployeeProfile | null;
  byManagerId(managerId: string): EmployeeProfile[];
  save(profile: EmployeeProfile): void;
  list(): EmployeeProfile[];
}

export class InMemoryProfileRepository implements ProfileRepository {
  private profiles = new Map<string, EmployeeProfile>();

  byUserId(userId: string): EmployeeProfile | null {
    return this.profiles.get(userId) ?? null;
  }
  byManagerId(managerId: string): EmployeeProfile[] {
    return this.list().filter((p) => p.managerId === managerId);
  }
  save(profile: EmployeeProfile): void {
    this.profiles.set(profile.userId, profile);
  }
  list(): EmployeeProfile[] {
    return [...this.profiles.values()];
  }
}

/** Role/level taxonomy: custom roles are rows, not code (master plan §7.2). */
export class TaxonomyStore {
  readonly roles: JobRole[] = [
    { id: 'qa', name: 'QA' },
    { id: 'rpa-dev', name: 'RPA Developer' },
    { id: 'ba', name: 'Business Analyst' },
    { id: 'pm', name: 'Project Manager' },
    { id: 'dev', name: 'Developer' },
    { id: 'devops', name: 'DevOps' },
    { id: 'sm', name: 'Scrum Master' },
    { id: 'po', name: 'Product Owner' },
  ];
  readonly levels: JobLevel[] = [
    { id: 'junior', name: 'Junior', rank: 1 },
    { id: 'mid', name: 'Mid', rank: 2 },
    { id: 'senior', name: 'Senior', rank: 3 },
    { id: 'lead', name: 'Lead', rank: 4 },
  ];

  addRole(role: JobRole): void {
    if (!this.roles.some((r) => r.id === role.id)) this.roles.push(role);
  }
  nextLevel(levelId: string): JobLevel | null {
    const current = this.levels.find((l) => l.id === levelId);
    return current ? (this.levels.find((l) => l.rank === current.rank + 1) ?? null) : null;
  }
}

export class InMemoryTeamRepository {
  private teams = new Map<string, Team>();

  save(team: Team): void {
    this.teams.set(team.id, team);
  }
  byId(id: string): Team | null {
    return this.teams.get(id) ?? null;
  }
  list(): Team[] {
    return [...this.teams.values()];
  }
}
