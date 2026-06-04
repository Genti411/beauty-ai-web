// Saved looks are retained for this many days from creation, then auto-purged.
// Placeholder pending the retention policy decision / attorney input.
export const RETENTION_DAYS = 365;

const DAY_MS = 86400_000;

// True if a look created at `createdAt` is older than `days` relative to `now`.
export function isExpired(createdAt: string, now: Date, days: number = RETENTION_DAYS): boolean {
  const ageMs = now.getTime() - new Date(createdAt).getTime();
  return ageMs > days * DAY_MS;
}
