import { createClient } from '@supabase/supabase-js';
import { RETENTION_DAYS } from './retention';

const BUCKET = 'look-images';
const DAY_MS = 86400_000;

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.');
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Deletes saved_looks older than RETENTION_DAYS, including their Storage objects.
// Service-role (bypasses RLS) — server/cron only. Returns the number purged.
export async function purgeExpiredLooks(now: Date = new Date()): Promise<number> {
  const supabase = admin();
  // Filter server-side by the retention cutoff so we never pull every row into
  // memory (an index on created_at keeps this cheap as the table grows).
  const cutoff = new Date(now.getTime() - RETENTION_DAYS * DAY_MS).toISOString();
  const { data, error } = await supabase
    .from('saved_looks')
    .select('id, image_path')
    .lt('created_at', cutoff);
  if (error) throw error;

  const expired = (data ?? []) as { id: string; image_path: string }[];
  if (expired.length === 0) return 0;

  const paths = expired.map((r) => r.image_path);
  const ids = expired.map((r) => r.id);

  // Rows first so a transient storage failure can't leave broken records.
  const { error: delError } = await supabase.from('saved_looks').delete().in('id', ids);
  if (delError) throw delError;

  // Rows are gone; surface a storage failure so the cron response/logs flag the
  // orphaned objects for recovery (a future purge can't find them — no row remains).
  const { error: storageError } = await supabase.storage.from(BUCKET).remove(paths);
  if (storageError) {
    throw new Error(`Rows purged but storage removal failed: ${storageError.message}`);
  }

  return expired.length;
}
