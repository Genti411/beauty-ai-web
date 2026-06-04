import { NextResponse } from 'next/server';
import { purgeExpiredLooks } from '@/lib/looks/purge';

async function handle(req: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'cron not configured' }, { status: 503 });
  }
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    const purged = await purgeExpiredLooks();
    return NextResponse.json({ purged });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'purge failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: Request): Promise<Response> {
  return handle(req);
}
export async function POST(req: Request): Promise<Response> {
  return handle(req);
}
