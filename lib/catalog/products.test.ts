import { rowToCard } from './products';

describe('rowToCard', () => {
  it('maps a db row to a ProductCard', () => {
    expect(
      rowToCard({
        id: 'p1',
        brand: 'Rouge Lab',
        name: 'Velvet Matte Lipstick',
        category: 'lipstick',
        shade_name: 'Crimson',
        image_url: 'https://example.com/x.jpg',
        price: 24,
        currency: 'USD',
        buy_url: 'https://example.com/buy/x',
        tryon_shades: { product_id: 'p1' },
      }),
    ).toEqual({
      id: 'p1',
      brand: 'Rouge Lab',
      name: 'Velvet Matte Lipstick',
      category: 'lipstick',
      shadeName: 'Crimson',
      imageUrl: 'https://example.com/x.jpg',
      price: 24,
      currency: 'USD',
      buyUrl: 'https://example.com/buy/x',
      hasTryOn: true,
    });
  });

  it('maps null shade_name/image_url/price to undefined', () => {
    const card = rowToCard({
      id: 'p2', brand: 'B', name: 'N', category: 'blush',
      shade_name: null, image_url: null, price: null, currency: 'USD',
      buy_url: 'https://example.com/buy/y',
      tryon_shades: null,
    });
    expect(card.shadeName).toBeUndefined();
    expect(card.imageUrl).toBeUndefined();
    expect(card.price).toBeUndefined();
    expect(card.hasTryOn).toBe(false);
  });
});
