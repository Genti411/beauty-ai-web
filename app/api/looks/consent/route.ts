import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { recordSavedLooksConsent } from '@/lib/profile/consent';

export async function POST(): Promise<Response> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  try {
    await recordSavedLooksConsent(user.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'consent failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
