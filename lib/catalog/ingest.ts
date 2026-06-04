// Polyfill WebSocket for Node.js < 22 (where native WebSocket is absent).
// The `ws` package ships with @supabase/supabase-js as a transitive dep.
// This runs before createClient so the realtime-js factory finds it.
if (typeof globalThis.WebSocket === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  globalThis.WebSocket = require('ws');
}

import { createClient } from '@supabase/supabase-js';
import type { FeedSource } from './feed-source';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.');
}

// Service-role client bypasses RLS for writes. Server/script-only — never
// imported by app/browser code (no NEXT_PUBLIC_ prefix on the key).
const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export async function ingest(source: FeedSource): Promise<number> {
  const products = await source.fetchProducts();

  for (const p of products) {
    const { data, error } = await admin
      .from('products')
      .upsert(
        {
          source: p.source,
          external_id: p.externalId,
          brand: p.brand,
          name: p.name,
          category: p.category,
          shade_name: p.shadeName ?? null,
          image_url: p.imageUrl ?? null,
          price: p.price ?? null,
          currency: p.currency,
          buy_url: p.buyUrl,
          popularity_score: p.popularityScore,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'source,external_id' },
      )
      .select('id')
      .single();
    if (error) throw error;

    if (p.shade) {
      const { error: shadeError } = await admin.from('tryon_shades').upsert(
        {
          product_id: data.id,
          hex: p.shade.hex,
          region: p.shade.region,
          finish: p.shade.finish ?? null,
        },
        { onConflict: 'product_id' },
      );
      if (shadeError) throw shadeError;
    }
  }

  return products.length;
}
