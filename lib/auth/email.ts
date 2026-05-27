export function normalizeEmail(input: string): string {
  return input.trim().toLowerCase();
}

export function isValidEmail(input: string): boolean {
  const email = normalizeEmail(input);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
