'use strict';

const { getRateToKzt, round2 } = require('../../src/services/exchange.service');

describe('exchange.service (unit)', () => {
  test('returns 1 for KZT', async () => {
    expect(await getRateToKzt('KZT')).toBe(1);
  });

  test('returns deterministic rate for EUR', async () => {
    expect(await getRateToKzt('EUR')).toBeGreaterThan(400);
    expect(await getRateToKzt('EUR')).toBeLessThan(700);
  });

  test('throws UnsupportedCurrency for unknown code', async () => {
    await expect(getRateToKzt('XYZ')).rejects.toMatchObject({
      code: 'UNSUPPORTED_CURRENCY',
      statusCode: 422,
    });
  });

  describe('round2', () => {
    test('rounds to 2 decimal places', () => {
      expect(round2(1.005)).toBeCloseTo(1.01, 2);
      expect(round2(2.345)).toBeCloseTo(2.35, 2);
      expect(round2(100)).toBe(100);
    });

    test('handles small values without underflow', () => {
      expect(round2(0.001)).toBe(0);
      expect(round2(0.005)).toBeCloseTo(0.01, 2);
    });
  });

  test('multi-currency snapshot math: 100 EUR → KZT', async () => {
    const rate = await getRateToKzt('EUR');
    const amountKzt = round2(100 * rate);
    expect(amountKzt).toBeCloseTo(100 * rate, 2);
  });
});