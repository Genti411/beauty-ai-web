/** @jest-environment node */
jest.mock('next/headers', () => ({ cookies: jest.fn() }));

import { createClient } from '@supabase/supabase-js';
import { purgeExpiredLooks } from '../../lib/looks/purge';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const BUCKET = 'look-images';

async function makeUser() {
  const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const email = `purge_${Date.now()}_${Math.random().toString(36).slice(2)}@example.com`;
  const { data, error } = await client.auth.signUp({ email, password: 'Password123!' });
  if (error) throw error;
  return data.user!.id;
}

describe('purgeExpiredLooks', () => {
  it('deletes expired looks (row + object) and keeps recent ones', async () => {
    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const userId = await makeUser();

    const oldPath = `${userId}/old.png`;
    const newPath = `${userId}/new.png`;
    const tinyPng = new Blob([Uint8Array.from([0x89, 0x50, 0x4e, 0x47])], { type: 'image/png' });
    await admin.storage.from(BUCKET).upload(oldPath, tinyPng);
    await admin.storage.from(BUCKET).upload(newPath, tinyPng);

    const old = new Date(Date.now() - 400 * 86400_000).toISOString(); // > 365d
    await admin.from('saved_looks').insert([
      { user_id: userId, image_path: oldPath, picks: [], created_at: old },
      { user_id: userId, image_path: newPath, picks: [] }, // created_at defaults to now
    ], { defaultToNull: false });

    const purged = await purgeExpiredLooks();
    expect(purged).toBeGreaterThanOrEqual(1);

    // Old row gone, new row remains.
    const rows = await admin.from('saved_looks').select('image_path').eq('user_id', userId);
    const remaining = (rows.data ?? []).map((r) => (r as { image_path: string }).image_path);
    expect(remaining).toContain(newPath);
    expect(remaining).not.toContain(oldPath);

    // Old object gone, new object remains.
    const listed = await admin.storage.from(BUCKET).list(userId);
    const names = (listed.data ?? []).map((o) => o.name);
    expect(names).toContain('new.png');
    expect(names).not.toContain('old.png');

    // Cleanup.
    await admin.from('saved_looks').delete().eq('user_id', userId);
    await admin.storage.from(BUCKET).remove([newPath]);
  });
});
