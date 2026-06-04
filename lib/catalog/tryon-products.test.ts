import { rowToTryOnProduct } from './tryon-products';

describe('rowToTryOnProduct', () => {
  it('maps a joined row to a TryOnProduct', () => {
    expect(
      rowToTryOnProduct({
        id: 'p1', brand: 'Rouge Lab', name: 'Velvet Matte Lipstick', category: 'lipstick',
        popularity_score: 90,
        buy_url: 'https://example.com/buy/p1',
        image_url: 'https://example.com/x.jpg',
        tryon_shades: { hex: '#B23A48', region: 'lips', finish: 'matte' },
      }),
    ).toEqual({
      id: 'p1', brand: 'Rouge Lab', name: 'Velvet Matte Lipstick', category: 'lipstick',
      popularityScore: 90,
      buyUrl: 'https://example.com/buy/p1',
      imageUrl: 'https://example.com/x.jpg',
      shade: { hex: '#B23A48', region: 'lips', finish: 'matte' },
    });
  });

  it('handles null image and null finish; accepts the shade as an array (Supabase embed)', () => {
    const result = rowToTryOnProduct({
      id: 'p2', brand: 'B', name: 'N', category: 'blush',
      popularity_score: 0,
      buy_url: 'https://example.com/buy/p2',
      image_url: null,
      tryon_shades: [{ hex: '#E8896B', region: 'cheeks', finish: null }],
    });
    expect(result.imageUrl).toBeUndefined();
    expect(result.shade).toEqual({ hex: '#E8896B', region: 'cheeks', finish: undefined });
    expect(result.popularityScore).toBe(0);
    expect(result.buyUrl).toBe('https://example.com/buy/p2');
  });
});
