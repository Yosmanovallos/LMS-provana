# Identity & Access

**Purpose:** authentication identity (external subject ↔ platform user), platform RBAC.

## Aggregates
- **User** — id, externalAuthId, email, displayName, role (`employee|manager|admin`), status
  (`active|inactive`), tenantId. Platform role ≠ job role (job roles live in Organization).

## Public queries (importable service)
- `IdentityQueries.getUser(userId)` → `{ id, email, displayName, role, status }`
- `IdentityQueries.listUsers(filter)` (admin)

## Events published
- `UserRegistered { userId, email, displayName, role }`
- `RoleAssigned { userId, role, assignedBy }`

## Events consumed
— none (upstream context).

## Invariants
- `externalAuthId` and `email` unique. Role changes only by admin; emits `RoleAssigned`.
- Users are soft-deactivated, never deleted (audit).

## Permissions (catalog keys)
`users.read`, `users.manage` (admin).
