/** @jest-environment node */
// next/headers is not available outside a request context; mock it so the
// module graph can load without throwing during import resolution.
jest.mock('next/headers', () => ({ cookies: jest.fn() }));

import { createClient } from '@supabase/supabase-js';
import { ingest } from '../../lib/catalog/ingest';
import { SampleFeedSource } from '../../lib/catalog/sample-feed';
import { rowToTryOnProduct } from '../../lib/catalog/tryon-products';
import type { TryOnProduct } from '../../lib/catalog/tryon-products';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

describe('getTryOnProducts', () => {
  beforeAll(async () => {
    await ingest(new SampleFeedSource());
  });

  it('returns only try-on-enabled products, each with a valid shade', async () => {
    const anon = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await anon
      .from('products')
      .select('id, brand, name, category, popularity_score, buy_url, image_url, tryon_shades!inner(hex, region, finish)')
      .order('popularity_score', { ascending: false });
    expect(error).toBeNull();
    const products: TryOnProduct[] = (data ?? []).map((r) =>
      rowToTryOnProduct(r as Parameters<typeof rowToTryOnProduct>[0]),
    );
    expect(products.length).toBe(5);
    for (const p of products) {
      expect(p.shade.hex).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(['lips', 'eyes', 'cheeks']).toContain(p.shade.region);
      expect(typeof p.popularityScore).toBe('number');
      expect(p.buyUrl).toMatch(/^https?:\/\//);
    }
  });
});
