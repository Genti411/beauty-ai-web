/** @jest-environment node */
import { createClient } from '@supabase/supabase-js';
import { ingest } from '../../lib/catalog/ingest';
import { SampleFeedSource } from '../../lib/catalog/sample-feed';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

describe('catalog ingestion + RLS', () => {
  // Start from a clean slate so the exact-count assertion is deterministic even
  // if a prior run (or a manual insert) left 'sample' rows behind.
  beforeAll(async () => {
    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    await admin.from('products').delete().eq('source', 'sample');
  });

  it('ingestion is idempotent (no duplicates on a second run)', async () => {
    await ingest(new SampleFeedSource());
    await ingest(new SampleFeedSource());

    const anon = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await anon
      .from('products')
      .select('id')
      .eq('source', 'sample');
    expect(error).toBeNull();
    expect(data!.length).toBe(8);
  });

  it('anon can read products (public RLS) but cannot write', async () => {
    const anon = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const read = await anon.from('products').select('id').limit(1);
    expect(read.error).toBeNull();
    expect(read.data!.length).toBeGreaterThan(0);

    const write = await anon.from('products').insert({
      source: 'sample', external_id: 'hack-1', brand: 'x', name: 'x',
      category: 'lipstick', buy_url: 'https://example.com', currency: 'USD',
    });
    expect(write.error).not.toBeNull();
  });
});
