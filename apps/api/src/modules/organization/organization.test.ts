import { describe, expect, it } from 'vitest';
import { createTestKernel } from '../shared-kernel/testing';
import { unwrap } from '../shared-kernel/result';
import { createIdentityModule } from '../identity/identity.module';
import { createOrganizationModule } from './organization.module';

const admin = { userId: 'admin-1', role: 'admin' as const };

function setup() {
  const kernel = createTestKernel();
  const identity = createIdentityModule(kernel);
  const org = createOrganizationModule({
    ...kernel,
    getUserRole: (id) => identity.queries.getRole(id),
  });
  const register = (email: string, name: string) =>
    unwrap(
      identity.registerUser.execute({ externalAuthId: `ext-${email}`, email, displayName: name }),
    ).userId;
  return { kernel, identity, org, register };
}

describe('organization', () => {
  it('auto-creates a profile when UserRegistered fires (idempotent)', () => {
    const { org, register } = setup();
    const userId = register('ana@x.co', 'Ana');
    const profile = org.queries.getProfile(userId);
    expect(profile?.displayName).toBe('Ana');
    expect(profile?.managerId).toBeNull();
  });

  it('assigns manager: admin-only, manager must hold manager/admin role', () => {
    const { kernel, identity, org, register } = setup();
    const employee = register('emp@x.co', 'Emp');
    const mgr = register('mgr@x.co', 'Mgr');

    // target manager is still a plain employee → rejected
    const invalid = org.assignManager.execute({ userId: employee, managerId: mgr }, admin);
    expect(invalid.ok).toBe(false);

    unwrap(identity.assignRole.execute({ userId: mgr, role: 'manager' }, admin));
    const denied = org.assignManager.execute(
      { userId: employee, managerId: mgr },
      { userId: mgr, role: 'manager' },
    );
    expect(denied.ok).toBe(false); // only admins assign managers

    unwrap(org.assignManager.execute({ userId: employee, managerId: mgr }, admin));
    expect(org.queries.getProfile(employee)?.managerId).toBe(mgr);
    expect(org.queries.isManagerOf(mgr, employee)).toBe(true);
    expect(kernel.outbox.all().map((e) => e.type)).toContain('EmployeeAssignedToManager');
  });

  it('getTeamMembers returns only the managed profiles (manager-scope primitive)', () => {
    const { identity, org, register } = setup();
    const a = register('a@x.co', 'A');
    const b = register('b@x.co', 'B');
    const c = register('c@x.co', 'C');
    const mgr = register('m@x.co', 'M');
    unwrap(identity.assignRole.execute({ userId: mgr, role: 'manager' }, admin));
    unwrap(org.assignManager.execute({ userId: a, managerId: mgr }, admin));
    unwrap(org.assignManager.execute({ userId: b, managerId: mgr }, admin));
    expect(org.queries.getTeamMembers(mgr).map((p) => p.userId).sort()).toEqual([a, b].sort());
    expect(org.queries.getTeamMembers(mgr).map((p) => p.userId)).not.toContain(c);
  });

  it('changes job level: appends history, sets tenure start, publishes JobLevelChanged', () => {
    const { kernel, org, register } = setup();
    const userId = register('q@x.co', 'Q');
    unwrap(org.changeJobLevel.execute({ userId, jobRoleId: 'qa', jobLevelId: 'junior' }, admin));
    unwrap(org.changeJobLevel.execute({ userId, jobRoleId: 'qa', jobLevelId: 'mid' }, admin));

    const profile = org.queries.getProfile(userId)!;
    expect(profile.jobLevelId).toBe('mid');
    expect(profile.levelHistory).toHaveLength(2);
    expect(profile.levelHistory[1]).toMatchObject({ fromLevelId: 'junior', toLevelId: 'mid' });
    expect(profile.currentLevelSince).toBe(kernel.clock.now().toISOString());
    expect(kernel.outbox.all().filter((e) => e.type === 'JobLevelChanged')).toHaveLength(2);
  });

  it('rejects unknown taxonomy values and self-management', () => {
    const { org, register } = setup();
    const userId = register('z@x.co', 'Z');
    expect(org.changeJobLevel.execute({ userId, jobRoleId: 'nope', jobLevelId: 'mid' }, admin).ok).toBe(false);
    expect(org.changeJobLevel.execute({ userId, jobRoleId: 'qa', jobLevelId: 'nope' }, admin).ok).toBe(false);
    expect(org.assignManager.execute({ userId, managerId: userId }, admin).ok).toBe(false);
  });
});
