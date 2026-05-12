'use strict';

const request = require('supertest');
const { buildApp } = require('../../src/app');
const {
  prisma,
  resetDatabase,
  makeUserWithTokens,
} = require('../helpers/factories');

const app = buildApp();


async function setupContributionFixture() {
  const { user: host, tokens } = await makeUserWithTokens({ role: 'HOST' });

  const regRes = await request(app)
    .post('/api/v1/registries')
    .set('Authorization', `Bearer ${tokens.access_token}`)
    .send({ title: 'Test Wedding', event_date: '2026-09-01', is_public: true });
  expect(regRes.status).toBe(201);
  const registry = regRes.body;

  const giftRes = await request(app)
    .post(`/api/v1/registries/${registry.id}/gifts`)
    .set('Authorization', `Bearer ${tokens.access_token}`)
    .send({ title: 'Test Gift', target_amount_kzt: 1000, required_tier_rank: 0 });
  expect(giftRes.status).toBe(201);
  const gift = giftRes.body;

  // Add a guest
  const guestRes = await request(app)
    .post(`/api/v1/registries/${registry.id}/guests`)
    .set('Authorization', `Bearer ${tokens.access_token}`)
    .send({
      display_name: 'Aizhan',
      kinship_label: 'jien',
      tier_rank: 0,
    });
  expect(guestRes.status).toBe(201);
  const guest = guestRes.body;

  return { host, tokens, registry, gift, guest };
}

describe('Atomic contribution — over-funding impossible (integration)', () => {
  beforeEach(async () => {
    await resetDatabase();
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  test('single contribution within cap succeeds (FUNDED status)', async () => {
    const { tokens, gift, guest } = await setupContributionFixture();

    const res = await request(app)
      .post(`/api/v1/gifts/${gift.id}/contributions`)
      .set('Authorization', `Bearer ${tokens.access_token}`)
      .send({
        guest_id: guest.id,
        amount_original: 500,
        currency_original: 'KZT',
      });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('FUNDED');
    expect(res.body.amount_kzt).toBe(500);
    expect(res.body.exchange_rate).toBe(1);
    expect(res.body.rate_locked_at).toBeDefined(); // snapshot timestamp
  });

  test('contribution that would exceed target → 422 POOL_CAP_EXCEEDED', async () => {
    const { tokens, gift, guest } = await setupContributionFixture();

    const first = await request(app)
      .post(`/api/v1/gifts/${gift.id}/contributions`)
      .set('Authorization', `Bearer ${tokens.access_token}`)
      .send({ guest_id: guest.id, amount_original: 800, currency_original: 'KZT' });
    expect(first.status).toBe(201);

    const second = await request(app)
      .post(`/api/v1/gifts/${gift.id}/contributions`)
      .set('Authorization', `Bearer ${tokens.access_token}`)
      .send({ guest_id: guest.id, amount_original: 300, currency_original: 'KZT' });

    expect(second.status).toBe(422);
    expect(second.body.code).toBe('POOL_CAP_EXCEEDED');
  });

  test('exact-fill contribution transitions gift state to FUNDED', async () => {
    const { tokens, gift, guest } = await setupContributionFixture();

    const res = await request(app)
      .post(`/api/v1/gifts/${gift.id}/contributions`)
      .set('Authorization', `Bearer ${tokens.access_token}`)
      .send({ guest_id: guest.id, amount_original: 1000, currency_original: 'KZT' });
    expect(res.status).toBe(201);

    const giftRow = await prisma.gift.findUnique({ where: { id: gift.id } });
    expect(giftRow.state).toBe('FUNDED');
    expect(Number(giftRow.currentAmountKzt)).toBe(1000);
  });

  test('contribution to a FUNDED gift → 409 GIFT_NOT_OPEN', async () => {
    const { tokens, gift, guest } = await setupContributionFixture();

    await request(app)
      .post(`/api/v1/gifts/${gift.id}/contributions`)
      .set('Authorization', `Bearer ${tokens.access_token}`)
      .send({ guest_id: guest.id, amount_original: 1000, currency_original: 'KZT' });

    const res = await request(app)
      .post(`/api/v1/gifts/${gift.id}/contributions`)
      .set('Authorization', `Bearer ${tokens.access_token}`)
      .send({ guest_id: guest.id, amount_original: 1, currency_original: 'KZT' });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('GIFT_NOT_OPEN');
  });

  test('multi-currency snapshot: rate is locked at contribution time (EUR)', async () => {
    const { tokens, gift, guest } = await setupContributionFixture();

    const res = await request(app)
      .post(`/api/v1/gifts/${gift.id}/contributions`)
      .set('Authorization', `Bearer ${tokens.access_token}`)
      .send({ guest_id: guest.id, amount_original: 1, currency_original: 'EUR' });

    expect(res.status).toBe(201);
    expect(res.body.currency_original).toBe('EUR');
    expect(res.body.amount_original).toBe(1);
    expect(res.body.exchange_rate).toBeGreaterThan(400); // EUR > 400 KZT
    expect(res.body.amount_kzt).toBe(
      Math.round(1 * res.body.exchange_rate * 100) / 100
    );
  });
});
