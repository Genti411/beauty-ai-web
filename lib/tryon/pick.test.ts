import { pickTopShades } from './pick';
import type { TryOnProduct } from '@/lib/catalog/tryon-products';

function p(
  id: string,
  category: 'lipstick' | 'eyeshadow' | 'blush',
  popularityScore: number,
  hex = '#000000',
  region: 'lips' | 'eyes' | 'cheeks' = 'lips',
): TryOnProduct {
  return {
    id, brand: 'B', name: id, category, popularityScore,
    buyUrl: `https://example.com/buy/${id}`,
    shade: { hex, region },
  };
}

const sample: TryOnProduct[] = [
  p('lip-a', 'lipstick', 90, '#A00000', 'lips'),
  p('lip-b', 'lipstick', 60, '#B00000', 'lips'),
  p('lip-c', 'lipstick', 75, '#C00000', 'lips'),
  p('eye-a', 'eyeshadow', 88, '#0000A0', 'eyes'),
  p('eye-b', 'eyeshadow', 50, '#0000B0', 'eyes'),
  p('blush-a', 'blush', 80, '#00A000', 'cheeks'),
];

describe('pickTopShades', () => {
  it('returns the most popular product per category for seed 0', () => {
    const picks = pickTopShades(sample, 0);
    expect(picks.map((p) => p.id).sort()).toEqual(['blush-a', 'eye-a', 'lip-a']);
  });

  it('seed 1 picks the second-most-popular per category, wrapping per group size', () => {
    const picks = pickTopShades(sample, 1);
    expect(picks.map((p) => p.id).sort()).toEqual(['blush-a', 'eye-b', 'lip-c']);
  });

  it('seed wraps modularly per group size', () => {
    const picks = pickTopShades(sample, 2);
    expect(picks.map((p) => p.id).sort()).toEqual(['blush-a', 'eye-a', 'lip-b']);
  });

  it('returns [] for empty input', () => {
    expect(pickTopShades([], 0)).toEqual([]);
  });

  it('ignores categories the engine does not render', () => {
    const products: TryOnProduct[] = [
      ...sample,
      { id: 'x', brand: 'B', name: 'x', category: 'foundation', popularityScore: 999, shade: { hex: '#fff', region: 'cheeks' } } as unknown as TryOnProduct,
    ];
    const picks = pickTopShades(products, 0);
    expect(picks.map((p) => p.category).sort()).toEqual(['blush', 'eyeshadow', 'lipstick']);
  });
});
