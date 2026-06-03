import type { TryOnProduct } from '@/lib/catalog/tryon-products';

export type SavedPick = {
  id: string;
  brand: string;
  name: string;
  category: string;
  buyUrl: string;
  shade: TryOnProduct['shade'];
};

// Project a TryOnProduct down to a minimal, stable shape stored in saved_looks.picks
// (jsonb). Avoids storing surprise fields and keeps the on-disk shape under our control.
export function serializePicks(picks: TryOnProduct[]): SavedPick[] {
  return picks.map((p) => ({
    id: p.id,
    brand: p.brand,
    name: p.name,
    category: p.category,
    buyUrl: p.buyUrl,
    shade: p.shade,
  }));
}
