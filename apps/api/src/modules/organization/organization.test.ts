import { describe, expect, it } from 'vitest';
import { PlatformRole } from '@lms/contracts';
import { createTestKernel } from '../shared-kernel/testing';
import { unwrap } from '../shared-kernel/result';
import { createOrganizationModule } from './organization.module';

const admin = { userId: 'admin-1', role: 'admin' as const };

function setup() {
  const kernel = createTestKernel();
  // identity is stubbed via its contract surface: a role lookup + UserRegistered events
  const roles = new Map<string, PlatformRole>();
  const org = createOrganizationModule({
    ...kernel,
    getUserRole: (id) => roles.get(id) ?? null,
  });
  let seq = 0;
  const register = (email: string, name: string) => {
    const userId = `user-${++seq}`;
    roles.set(userId, 'employee');
    kernel.publisher.publishPending('identity', [
      {
        type: 'UserRegistered',
        aggregateId: userId,
        payload: { userId, email, displayName: name, role: 'employee' },
      },
    ]);
    return userId;
  };
  const setRole = (userId: string, role: PlatformRole) => roles.set(userId, role);
  return { kernel, org, register, setRole };
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
    const { kernel, org, register, setRole } = setup();
    const employee = register('emp@x.co', 'Emp');
    const mgr = register('mgr@x.co', 'Mgr');

    // target manager is still a plain employee → rejected
    const invalid = org.assignManager.execute({ userId: employee, managerId: mgr }, admin);
    expect(invalid.ok).toBe(false);

    setRole(mgr, 'manager');
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
    const { org, register, setRole } = setup();
    const a = register('a@x.co', 'A');
    const b = register('b@x.co', 'B');
    const c = register('c@x.co', 'C');
    const mgr = register('m@x.co', 'M');
    setRole(mgr, 'manager');
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
