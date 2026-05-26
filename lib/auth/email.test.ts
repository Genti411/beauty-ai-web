import { normalizeEmail, isValidEmail } from './email';

describe('normalizeEmail', () => {
  it('trims whitespace and lowercases', () => {
    expect(normalizeEmail('  User@Example.COM ')).toBe('user@example.com');
  });
});

describe('isValidEmail', () => {
  it('accepts a normal address', () => {
    expect(isValidEmail('user@example.com')).toBe(true);
  });
  it('rejects an address with no @', () => {
    expect(isValidEmail('userexample.com')).toBe(false);
  });
  it('rejects an empty string', () => {
    expect(isValidEmail('')).toBe(false);
  });
});
