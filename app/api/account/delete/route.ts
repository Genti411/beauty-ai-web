import { NextResponse } from 'next/server';
import { createClient as createServer } from '@/lib/supabase/server';
import { createClient as createAdmin } from '@supabase/supabase-js';

const BUCKET = 'look-images';

export async function POST(): Promise<Response> {
  const supabase = await createServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ error: 'not configured' }, { status: 503 });
  }
  const admin = createAdmin(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1) Remove the user's storage objects. Abort before deleting the user if this fails
  //    (avoid orphaned objects whose owner row no longer exists).
  const listed = await admin.storage.from(BUCKET).list(user.id);
  if (listed.error) {
    return NextResponse.json({ error: 'storage cleanup failed' }, { status: 500 });
  }
  const paths = (listed.data ?? []).map((o) => `${user.id}/${o.name}`);
  if (paths.length > 0) {
    const removed = await admin.storage.from(BUCKET).remove(paths);
    if (removed.error) {
      return NextResponse.json({ error: 'storage cleanup failed' }, { status: 500 });
    }
  }

  // 2) Delete the auth user — cascades profiles + saved_looks via FK on delete cascade.
  const del = await admin.auth.admin.deleteUser(user.id);
  if (del.error) {
    return NextResponse.json({ error: del.error.message }, { status: 500 });
  }

  // 3) Clear the session cookie.
  await supabase.auth.signOut();
  return NextResponse.json({ ok: true });
}
