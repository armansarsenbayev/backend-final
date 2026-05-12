'use strict';

const request = require('supertest');
const { buildApp } = require('../../src/app');
const { prisma, resetDatabase } = require('../helpers/factories');

const app = buildApp();

describe('Auth flow (integration)', () => {
  beforeEach(async () => {
    await resetDatabase();
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  test('register → login → /me happy path', async () => {
    const reg = await request(app).post('/api/v1/auth/register').send({
      email: 'aizhan@example.kz',
      username: 'aizhan',
      password: 'Saukele2025!',
      role: 'HOST',
    });
    expect(reg.status).toBe(201);
    expect(reg.body).toMatchObject({ email: 'aizhan@example.kz', role: 'HOST' });
    expect(reg.body.passwordHash).toBeUndefined();

    const login = await request(app).post('/api/v1/auth/login').send({
      email: 'aizhan@example.kz',
      password: 'Saukele2025!',
    });
    expect(login.status).toBe(200);
    expect(login.body.access_token).toBeDefined();
    expect(login.body.refresh_token).toBeDefined();
    expect(login.body.token_type).toBe('Bearer');

    const me = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${login.body.access_token}`);
    expect(me.status).toBe(200);
    expect(me.body.email).toBe('aizhan@example.kz');
  });

  test('register rejects role=ADMIN (cannot self-assign)', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      email: 'evil@example.com',
      username: 'evil',
      password: 'NotAdmin123!',
      role: 'ADMIN',
    });
    expect(res.status).toBe(422); // Zod rejects ADMIN at validation
  });

  test('login with wrong password returns 401 INVALID_CREDENTIALS', async () => {
    await request(app).post('/api/v1/auth/register').send({
      email: 'a@b.com',
      username: 'aa',
      password: 'Correct123!',
      role: 'GUEST',
    });
    const res = await request(app).post('/api/v1/auth/login').send({
      email: 'a@b.com',
      password: 'Wrong123!',
    });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_CREDENTIALS');
  });

  test('protected route without token → 401', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHENTICATED');
  });

  test('protected route with malformed token → 401 INVALID_TOKEN', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer not.a.real.jwt');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_TOKEN');
  });

  test('refresh rotates the token: old token becomes invalid', async () => {
    await request(app).post('/api/v1/auth/register').send({
      email: 'rot@example.com',
      username: 'rotuser',
      password: 'StrongPass1!',
      role: 'GUEST',
    });
    const login = await request(app).post('/api/v1/auth/login').send({
      email: 'rot@example.com',
      password: 'StrongPass1!',
    });
    const oldRefresh = login.body.refresh_token;

    const r1 = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refresh_token: oldRefresh });
    expect(r1.status).toBe(200);
    expect(r1.body.refresh_token).not.toBe(oldRefresh);

    // Replay of the OLD refresh token must now fail.
    const r2 = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refresh_token: oldRefresh });
    expect(r2.status).toBe(401);
    expect(r2.body.code).toBe('INVALID_TOKEN');
  });

  test('logout invalidates the refresh token', async () => {
    const reg = await request(app).post('/api/v1/auth/register').send({
      email: 'lo@example.com',
      username: 'logoutuser',
      password: 'StrongPass1!',
      role: 'GUEST',
    });
    expect(reg.status).toBe(201);

    const login = await request(app).post('/api/v1/auth/login').send({
      email: 'lo@example.com',
      password: 'StrongPass1!',
    });
    expect(login.status).toBe(200);

    const out = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${login.body.access_token}`)
      .send({ refresh_token: login.body.refresh_token });
    expect(out.status).toBe(204);

    const reuse = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refresh_token: login.body.refresh_token });
    expect(reuse.status).toBe(401);
  });
});