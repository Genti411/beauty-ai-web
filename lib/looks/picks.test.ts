import { serializePicks } from './picks';
import type { TryOnProduct } from '@/lib/catalog/tryon-products';

const sample: TryOnProduct[] = [
  {
    id: 'lip-1', brand: 'Rouge Lab', name: 'Velvet Matte Lipstick',
    category: 'lipstick', popularityScore: 95, buyUrl: 'https://example.com/buy/lip-1',
    imageUrl: 'https://example.com/x.jpg',
    shade: { hex: '#B23A48', region: 'lips', finish: 'matte' },
  },
];

describe('serializePicks', () => {
  it('keeps only the documented fields', () => {
    expect(serializePicks(sample)).toEqual([
      {
        id: 'lip-1', brand: 'Rouge Lab', name: 'Velvet Matte Lipstick',
        category: 'lipstick', buyUrl: 'https://example.com/buy/lip-1',
        shade: { hex: '#B23A48', region: 'lips', finish: 'matte' },
      },
    ]);
  });

  it('preserves order', () => {
    const second: TryOnProduct = { ...sample[0], id: 'lip-2' };
    expect(serializePicks([sample[0], second]).map((p) => p.id)).toEqual(['lip-1', 'lip-2']);
  });
});
