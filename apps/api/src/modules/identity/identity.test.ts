import { describe, expect, it } from 'vitest';
import { createTestKernel } from '../shared-kernel/testing';
import { unwrap } from '../shared-kernel/result';
import { createIdentityModule } from './identity.module';

const admin = { userId: 'admin-1', role: 'admin' as const };

function setup() {
  const kernel = createTestKernel();
  const identity = createIdentityModule(kernel);
  return { kernel, identity };
}

describe('identity', () => {
  it('registers a user, defaults to employee, publishes UserRegistered', () => {
    const { kernel, identity } = setup();
    const { userId } = unwrap(
      identity.registerUser.execute({
        externalAuthId: 'ext-1',
        email: 'Ana@Example.com',
        displayName: 'Ana',
      }),
    );
    const view = identity.queries.getUser(userId)!;
    expect(view.role).toBe('employee');
    expect(view.email).toBe('ana@example.com'); // normalized
    expect(kernel.outbox.all().map((e) => e.type)).toEqual(['UserRegistered']);
  });

  it('rejects duplicate email and duplicate externalAuthId', () => {
    const { identity } = setup();
    identity.registerUser.execute({ externalAuthId: 'e1', email: 'a@b.co', displayName: 'A' });
    const dupEmail = identity.registerUser.execute({
      externalAuthId: 'e2', email: 'A@B.CO', displayName: 'B',
    });
    expect(dupEmail.ok).toBe(false);
    if (!dupEmail.ok) expect(dupEmail.error.code).toBe('conflict');
    const dupExt = identity.registerUser.execute({
      externalAuthId: 'e1', email: 'c@d.co', displayName: 'C',
    });
    expect(dupExt.ok).toBe(false);
  });

  it('only admins assign roles; assignment publishes RoleAssigned', () => {
    const { kernel, identity } = setup();
    const { userId } = unwrap(
      identity.registerUser.execute({ externalAuthId: 'e1', email: 'a@b.co', displayName: 'A' }),
    );
    const denied = identity.assignRole.execute(
      { userId, role: 'manager' },
      { userId: 'other', role: 'manager' },
    );
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.error.code).toBe('forbidden');

    unwrap(identity.assignRole.execute({ userId, role: 'manager' }, admin));
    expect(identity.queries.getRole(userId)).toBe('manager');
    expect(kernel.outbox.all().map((e) => e.type)).toContain('RoleAssigned');
  });

  it('re-assigning the same role is a no-op (no duplicate event)', () => {
    const { kernel, identity } = setup();
    const { userId } = unwrap(
      identity.registerUser.execute({ externalAuthId: 'e1', email: 'a@b.co', displayName: 'A' }),
    );
    unwrap(identity.assignRole.execute({ userId, role: 'employee' }, admin));
    expect(kernel.outbox.all().filter((e) => e.type === 'RoleAssigned')).toHaveLength(0);
  });
});
