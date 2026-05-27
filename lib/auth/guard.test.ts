import { shouldRedirectToLogin } from './guard';

describe('shouldRedirectToLogin', () => {
  it('redirects an unauthenticated user from a protected route', () => {
    expect(shouldRedirectToLogin('/account', false)).toBe(true);
  });
  it('redirects from a nested protected route', () => {
    expect(shouldRedirectToLogin('/account/settings', false)).toBe(true);
  });
  it('does not redirect an authenticated user from a protected route', () => {
    expect(shouldRedirectToLogin('/account', true)).toBe(false);
  });
  it('does not redirect on the public landing page', () => {
    expect(shouldRedirectToLogin('/', false)).toBe(false);
  });
  it('does not redirect on the login page', () => {
    expect(shouldRedirectToLogin('/login', false)).toBe(false);
  });
});
