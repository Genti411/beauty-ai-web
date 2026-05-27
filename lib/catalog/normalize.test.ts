import { normalizeProduct } from './normalize';

const rawValid = {
  source: 'sample',
  external_id: 'lip-001',
  brand: 'Rouge Lab',
  name: 'Velvet Matte Lipstick',
  category: 'lipstick',
  shade_name: 'Crimson',
  image_url: 'https://example.com/lip-001.jpg',
  price: 24,
  currency: 'USD',
  buy_url: 'https://example.com/buy/lip-001',
  popularity_score: 90,
};

describe('normalizeProduct', () => {
  it('maps a valid raw row to a NormalizedProduct', () => {
    expect(normalizeProduct(rawValid)).toEqual({
      source: 'sample',
      externalId: 'lip-001',
      brand: 'Rouge Lab',
      name: 'Velvet Matte Lipstick',
      category: 'lipstick',
      shadeName: 'Crimson',
      imageUrl: 'https://example.com/lip-001.jpg',
      price: 24,
      currency: 'USD',
      buyUrl: 'https://example.com/buy/lip-001',
      popularityScore: 90,
    });
  });

  it('returns null when a required field is missing', () => {
    expect(normalizeProduct({ ...rawValid, buy_url: undefined })).toBeNull();
  });

  it('returns null for an unknown category', () => {
    expect(normalizeProduct({ ...rawValid, category: 'perfume' })).toBeNull();
  });

  it('defaults currency to USD and popularity to 0 when absent', () => {
    const { currency, popularity_score, ...rest } = rawValid;
    const result = normalizeProduct(rest);
    expect(result?.currency).toBe('USD');
    expect(result?.popularityScore).toBe(0);
  });
});
