import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildExportPayload, type ExportLook, type ExportProfile } from '@/lib/account/export';

export async function GET(): Promise<Response> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, display_name, saved_looks_consented_at')
    .eq('id', user.id)
    .maybeSingle();

  const { data: looks } = await supabase
    .from('saved_looks')
    .select('id, image_path, picks, created_at')
    .eq('user_id', user.id) // defense-in-depth; RLS already scopes this
    .order('created_at', { ascending: false });

  const payload = buildExportPayload(
    (profile as ExportProfile | null) ?? null,
    (looks as ExportLook[] | null) ?? [],
  );

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'content-disposition': 'attachment; filename="beauty-ai-data.json"',
    },
  });
}
