import { rowToTryOnProduct } from './tryon-products';

describe('rowToTryOnProduct', () => {
  it('maps a joined row to a TryOnProduct', () => {
    expect(
      rowToTryOnProduct({
        id: 'p1', brand: 'Rouge Lab', name: 'Velvet Matte Lipstick', category: 'lipstick',
        image_url: 'https://example.com/x.jpg',
        tryon_shades: { hex: '#B23A48', region: 'lips', finish: 'matte' },
      }),
    ).toEqual({
      id: 'p1', brand: 'Rouge Lab', name: 'Velvet Matte Lipstick', category: 'lipstick',
      imageUrl: 'https://example.com/x.jpg',
      shade: { hex: '#B23A48', region: 'lips', finish: 'matte' },
    });
  });

  it('handles null image and null finish; accepts the shade as an array (Supabase embed)', () => {
    const result = rowToTryOnProduct({
      id: 'p2', brand: 'B', name: 'N', category: 'blush', image_url: null,
      tryon_shades: [{ hex: '#E8896B', region: 'cheeks', finish: null }],
    });
    expect(result.imageUrl).toBeUndefined();
    expect(result.shade).toEqual({ hex: '#E8896B', region: 'cheeks', finish: undefined });
  });
});
