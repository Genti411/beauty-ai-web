import { createClient } from '@/lib/supabase/server';
import type { ShadeData } from './types';

export type TryOnProduct = {
  id: string;
  brand: string;
  name: string;
  category: string;
  imageUrl?: string;
  // v1: one shade per product. The engine's applyLook accepts a shade LIST so a
  // later slice (generate-a-look) can layer multiple products into one look.
  shade: ShadeData;
};

type ShadeRow = { hex: string; region: string; finish: string | null };
type TryOnRow = {
  id: string;
  brand: string;
  name: string;
  category: string;
  image_url: string | null;
  // Supabase may return an embedded to-one relation as an object OR a
  // single-element array depending on relationship detection — handle both.
  tryon_shades: ShadeRow | ShadeRow[];
};

function firstShade(s: ShadeRow | ShadeRow[]): ShadeRow {
  return Array.isArray(s) ? s[0] : s;
}

export function rowToTryOnProduct(row: TryOnRow): TryOnProduct {
  const shade = firstShade(row.tryon_shades);
  return {
    id: row.id,
    brand: row.brand,
    name: row.name,
    category: row.category,
    imageUrl: row.image_url ?? undefined,
    shade: {
      hex: shade.hex,
      region: shade.region as ShadeData['region'],
      finish: shade.finish ?? undefined,
    },
  };
}

export async function getTryOnProducts(): Promise<TryOnProduct[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('products')
    .select('id, brand, name, category, image_url, tryon_shades!inner(hex, region, finish)')
    .order('popularity_score', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => rowToTryOnProduct(r as unknown as TryOnRow));
}
