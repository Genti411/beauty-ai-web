import type { TryOnProduct } from '@/lib/catalog/tryon-products';

const SUPPORTED_CATEGORIES = ['lipstick', 'eyeshadow', 'blush'] as const;

// Picks the seed-th most-popular product per supported category. seed wraps
// modularly within each category group; categories with no products are
// silently skipped, categories the engine doesn't render are ignored.
export function pickTopShades(products: TryOnProduct[], seed: number = 0): TryOnProduct[] {
  if (products.length === 0) return [];

  const result: TryOnProduct[] = [];
  for (const category of SUPPORTED_CATEGORIES) {
    const group = products
      .filter((p) => p.category === category)
      .sort((a, b) => b.popularityScore - a.popularityScore);
    if (group.length === 0) continue;
    result.push(group[seed % group.length]);
  }
  return result;
}
