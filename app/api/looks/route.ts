import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { saveLook } from '@/lib/looks/looks';
import type { TryOnProduct } from '@/lib/catalog/tryon-products';

export async function POST(req: Request): Promise<Response> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const form = await req.formData();
  const blob = form.get('blob');
  const picksJson = form.get('picksJson');
  if (!(blob instanceof Blob) || typeof picksJson !== 'string') {
    return NextResponse.json({ error: 'bad request' }, { status: 400 });
  }
  let picks: TryOnProduct[];
  try {
    picks = JSON.parse(picksJson);
  } catch {
    return NextResponse.json({ error: 'bad picks json' }, { status: 400 });
  }
  if (!Array.isArray(picks) || picks.length === 0) {
    return NextResponse.json({ error: 'picks required' }, { status: 400 });
  }

  try {
    const { id } = await saveLook({ userId: user.id, blob, picks });
    return NextResponse.json({ id });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'save failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
