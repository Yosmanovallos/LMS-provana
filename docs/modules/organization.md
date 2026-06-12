# Organization

**Purpose:** employee profiles, departments/teams, job role × level taxonomy, manager links.

## Aggregates
- **EmployeeProfile** — userId (PK), displayName, departmentId, teamId, managerId?,
  jobRoleId, jobLevelId, levelHistory[] (append-only `{ from, to, changedBy, at }`).
- **Team** — id, name, departmentId.
- **JobRole** (QA, RPA Dev, BA, PM, Dev, DevOps, SM, PO, custom rows) and
  **JobLevel** (Junior|Mid|Senior|Lead) form the RoleLevel key `(jobRoleId, jobLevelId)`
  referenced by Learning paths and Promotion requirement sets. Custom roles = rows, not code.

## Public queries
- `OrgQueries.getProfile(userId)`; `OrgQueries.getTeamMembers(managerId)` →
  profiles whose `managerId` = arg (THE manager-scope primitive used by other modules' guards);
  `OrgQueries.listRoleLevels()`.

## Events published
- `EmployeeAssignedToManager { userId, managerId, assignedBy }`
- `JobLevelChanged { userId, jobRoleId, fromLevelId, toLevelId, changedBy }`

## Events consumed
- `UserRegistered` → auto-create empty EmployeeProfile.

## Invariants
- A profile exists per registered user; managerId must reference a user with role manager/admin;
  level changes append to levelHistory (never rewrite).

## Permissions
`org.read`, `org.manage` (admin), manager reads limited to own team via query scope.
