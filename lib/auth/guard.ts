const PROTECTED_PREFIXES = ['/account', '/looks'];

export function shouldRedirectToLogin(pathname: string, isAuthenticated: boolean): boolean {
  if (isAuthenticated) return false;
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + '/'),
  );
}
