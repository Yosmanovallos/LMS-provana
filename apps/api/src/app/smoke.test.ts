import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

/**
 * Boot smoke (plan exit criterion): the real Nest app starts with the seeded container
 * and serves health + an authed golden-path read over actual HTTP.
 */
describe('nest boot smoke', () => {
  let app: INestApplication;
  let base: string;

  beforeAll(async () => {
    app = await NestFactory.create(AppModule, { logger: false });
    await app.listen(0); // ephemeral port; no supertest dependency needed
    base = (await app.getUrl()).replace('[::1]', '127.0.0.1');
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves /health without auth', async () => {
    const res = await fetch(`${base}/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: 'ok' });
  });

  it('rejects authed routes without dev headers', async () => {
    const res = await fetch(`${base}/my-learning`);
    expect(res.status).toBe(401);
  });

  it('serves the golden path over HTTP: personas → Ana at 82% readiness', async () => {
    const personas = (await (await fetch(`${base}/dev/personas`)).json()) as {
      userId: string;
      role: string;
      displayName: string;
    }[];
    expect(personas).toHaveLength(4);
    const ana = personas.find((p) => p.displayName === 'Ana Quintero')!;

    const res = await fetch(`${base}/promotion/gap/${ana.userId}`, {
      headers: { 'x-user-id': ana.userId, 'x-user-role': 'employee' },
    });
    expect(res.status).toBe(200);
    const report = (await res.json()) as { percentReady: number; missing: { label: string }[] };
    expect(report.percentReady).toBe(82);
    expect(report.missing).toHaveLength(3);
  });

  it('maps Result errors to HTTP codes (manager scope forbidden)', async () => {
    const personas = (await (await fetch(`${base}/dev/personas`)).json()) as {
      userId: string;
      displayName: string;
    }[];
    const ana = personas.find((p) => p.displayName === 'Ana Quintero')!;
    const ben = personas.find((p) => p.displayName === 'Ben Dervis')!;

    // Ben (employee, not Ana's manager) must not read Ana's gap report
    const res = await fetch(`${base}/promotion/gap/${ana.userId}`, {
      headers: { 'x-user-id': ben.userId, 'x-user-role': 'employee' },
    });
    expect(res.status).toBe(403);
  });
});
