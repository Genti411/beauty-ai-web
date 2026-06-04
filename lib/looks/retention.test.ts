import { isExpired, RETENTION_DAYS } from './retention';

const now = new Date('2026-05-29T00:00:00Z');

describe('isExpired', () => {
  it('is false for a look created today', () => {
    expect(isExpired('2026-05-29T00:00:00Z', now)).toBe(false);
  });
  it('is false just within the window', () => {
    const within = new Date(now.getTime() - (RETENTION_DAYS - 1) * 86400_000).toISOString();
    expect(isExpired(within, now)).toBe(false);
  });
  it('is true past the window', () => {
    const past = new Date(now.getTime() - (RETENTION_DAYS + 1) * 86400_000).toISOString();
    expect(isExpired(past, now)).toBe(true);
  });
  it('honors a custom day count', () => {
    const tenDaysAgo = new Date(now.getTime() - 10 * 86400_000).toISOString();
    expect(isExpired(tenDaysAgo, now, 5)).toBe(true);
    expect(isExpired(tenDaysAgo, now, 30)).toBe(false);
  });
});
