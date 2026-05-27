import { SampleFeedSource } from './sample-feed';
import { CATEGORIES } from './types';

describe('SampleFeedSource', () => {
  it('has source "sample"', () => {
    expect(new SampleFeedSource().source).toBe('sample');
  });

  it('returns several products, all with valid required fields and known categories', async () => {
    const products = await new SampleFeedSource().fetchProducts();
    expect(products.length).toBeGreaterThanOrEqual(6);
    for (const p of products) {
      expect(p.source).toBe('sample');
      expect(p.externalId).toBeTruthy();
      expect(p.brand).toBeTruthy();
      expect(p.name).toBeTruthy();
      expect(p.buyUrl).toMatch(/^https?:\/\//);
      expect(CATEGORIES).toContain(p.category);
    }
  });

  it('has unique externalIds', async () => {
    const products = await new SampleFeedSource().fetchProducts();
    const ids = products.map((p) => p.externalId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('includes at least 4 try-on-enabled products with valid shade data', async () => {
    const products = await new SampleFeedSource().fetchProducts();
    const withShade = products.filter((p) => p.shade);
    expect(withShade.length).toBeGreaterThanOrEqual(4);
    for (const p of withShade) {
      expect(p.shade!.hex).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(['lips', 'eyes', 'cheeks']).toContain(p.shade!.region);
    }
  });
});
