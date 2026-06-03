// Storage object key for a saved look. The first segment must equal the
// owner's user id — the Storage RLS policy enforces it.
export function pathFor(userId: string, lookId: string): string {
  return `${userId}/${lookId}.png`;
}
