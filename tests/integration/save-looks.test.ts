/** @jest-environment node */
jest.mock('next/headers', () => ({ cookies: jest.fn() }));

import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const BUCKET = 'look-images';

function freshClient() {
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function signUpUser() {
  const client = freshClient();
  const email = `s_${Date.now()}_${Math.random().toString(36).slice(2)}@example.com`;
  const { data, error } = await client.auth.signUp({ email, password: 'Password123!' });
  if (error) throw error;
  return { client, userId: data.user!.id };
}

describe('save-looks RLS + Storage isolation', () => {
  it('isolates saved_looks rows and look-images objects between users', async () => {
    const a = await signUpUser();
    const b = await signUpUser();

    // --- DB isolation ---
    const insertA = await a.client.from('saved_looks').insert({
      user_id: a.userId,
      image_path: `${a.userId}/x.png`,
      picks: [],
    }).select('id').single();
    expect(insertA.error).toBeNull();
    const lookAId = (insertA.data as { id: string }).id;

    // B cannot see or delete A's row.
    const bSeesA = await b.client.from('saved_looks').select('id').eq('id', lookAId).maybeSingle();
    expect(bSeesA.data).toBeNull();

    const bDeletesA = await b.client.from('saved_looks').delete().eq('id', lookAId);
    expect(bDeletesA.error).toBeNull();
    const stillThere = await a.client.from('saved_looks').select('id').eq('id', lookAId).maybeSingle();
    expect(stillThere.data?.id).toBe(lookAId); // RLS hid the row from B; A's row survives

    // B cannot insert into A's user_id.
    const bImpersonatesA = await b.client.from('saved_looks').insert({
      user_id: a.userId,
      image_path: `${a.userId}/x2.png`,
      picks: [],
    });
    expect(bImpersonatesA.error).not.toBeNull();

    // --- Storage isolation ---
    const aPath = `${a.userId}/own.png`;
    const bPath = `${b.userId}/own.png`;
    const tinyPng = new Blob(
      [Uint8Array.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])],
      { type: 'image/png' },
    );

    const aOwnUp = await a.client.storage.from(BUCKET).upload(aPath, tinyPng);
    expect(aOwnUp.error).toBeNull();

    // A cannot upload under B's prefix.
    const aImp = await a.client.storage.from(BUCKET).upload(bPath, tinyPng);
    expect(aImp.error).not.toBeNull();

    // B cannot read A's object.
    const bReadsA = await b.client.storage.from(BUCKET).createSignedUrl(aPath, 60);
    expect(bReadsA.error).not.toBeNull();

    // Cleanup: A removes own.
    await a.client.storage.from(BUCKET).remove([aPath]);
  });
});
