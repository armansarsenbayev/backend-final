'use strict';

const {
  encodeCursor,
  decodeCursor,
  buildNextCursor,
} = require('../../src/utils/pagination');

describe('pagination cursor (unit)', () => {
  test('encode/decode roundtrip preserves payload', () => {
    const payload = { createdAt: '2024-01-01T00:00:00.000Z', id: 'abc-123' };
    const cursor = encodeCursor(payload);
    expect(typeof cursor).toBe('string');
    expect(decodeCursor(cursor)).toEqual(payload);
  });

  test('decodeCursor returns null for invalid input', () => {
    expect(decodeCursor(null)).toBeNull();
    expect(decodeCursor(undefined)).toBeNull();
    expect(decodeCursor('not-base64!@#')).toBeNull();
    expect(decodeCursor(encodeCursor('plain string'))).toBeNull();
  });

  test('buildNextCursor returns null when fewer items than limit', () => {
    const items = [{ id: '1', createdAt: new Date() }];
    const next = buildNextCursor(items, 20, (it) => ({ id: it.id }));
    expect(next).toBeNull();
  });

  test('buildNextCursor returns cursor when page is full', () => {
    const items = [
      { id: '1', createdAt: new Date('2024-01-01') },
      { id: '2', createdAt: new Date('2024-01-02') },
    ];
    const next = buildNextCursor(items, 2, (it) => ({
      id: it.id,
      createdAt: it.createdAt.toISOString(),
    }));
    expect(next).not.toBeNull();
    expect(decodeCursor(next)).toMatchObject({ id: '2' });
  });
});