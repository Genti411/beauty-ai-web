import { hasSavedLooksConsent } from './consent';

describe('hasSavedLooksConsent', () => {
  it('returns true when the timestamp is set', () => {
    expect(hasSavedLooksConsent({ saved_looks_consented_at: '2026-05-28T00:00:00Z' })).toBe(true);
  });
  it('returns false when null or missing', () => {
    expect(hasSavedLooksConsent({ saved_looks_consented_at: null })).toBe(false);
    expect(hasSavedLooksConsent({})).toBe(false);
  });
});
