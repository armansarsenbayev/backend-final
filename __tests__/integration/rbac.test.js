'use strict';

const request = require('supertest');
const { buildApp } = require('../../src/app');
const { prisma, resetDatabase, makeUserWithTokens } = require('../helpers/factories');

const app = buildApp();

describe('RBAC access control (integration)', () => {
  beforeEach(async () => {
    await resetDatabase();
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  test('GUEST cannot create a registry → 403 FORBIDDEN', async () => {
    const { tokens } = await makeUserWithTokens({ role: 'GUEST' });

    const res = await request(app)
      .post('/api/v1/registries')
      .set('Authorization', `Bearer ${tokens.access_token}`)
      .send({ title: 'My Wedding', event_date: '2026-09-01', is_public: true });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  test('HOST can create a registry → 201', async () => {
    const { tokens } = await makeUserWithTokens({ role: 'HOST' });

    const res = await request(app)
      .post('/api/v1/registries')
      .set('Authorization', `Bearer ${tokens.access_token}`)
      .send({ title: 'Aizhan & Dias Wedding', event_date: '2026-09-01', is_public: true });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Aizhan & Dias Wedding');
  });

  test('unauthenticated request to protected route → 401 (not 403)', async () => {
    const res = await request(app)
      .post('/api/v1/registries')
      .send({ title: 'test', event_date: '2026-09-01' });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHENTICATED');
  });

  test('GUEST cannot access admin user list → 403 FORBIDDEN', async () => {
    const { tokens } = await makeUserWithTokens({ role: 'GUEST' });

    const res = await request(app)
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${tokens.access_token}`);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  test('HOST cannot access admin user list → 403 FORBIDDEN', async () => {
    const { tokens } = await makeUserWithTokens({ role: 'HOST' });

    const res = await request(app)
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${tokens.access_token}`);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });
});
