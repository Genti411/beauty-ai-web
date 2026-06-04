import type { FeedSource } from './feed-source';
import type { NormalizedProduct } from './types';

const SAMPLE: NormalizedProduct[] = [
  {
    source: 'sample', externalId: 'lip-001', brand: 'Rouge Lab',
    name: 'Velvet Matte Lipstick', category: 'lipstick', shadeName: 'Crimson',
    imageUrl: 'https://placehold.co/400x400?text=Crimson', price: 24, currency: 'USD',
    buyUrl: 'https://example.com/buy/lip-001', popularityScore: 95,
    shade: { hex: '#B23A48', region: 'lips', finish: 'matte' },
  },
  {
    source: 'sample', externalId: 'lip-002', brand: 'Glow Theory',
    name: 'Sheer Tint Balm', category: 'lipstick', shadeName: 'Rosewood',
    imageUrl: 'https://placehold.co/400x400?text=Rosewood', price: 18, currency: 'USD',
    buyUrl: 'https://example.com/buy/lip-002', popularityScore: 88,
    shade: { hex: '#A8576B', region: 'lips', finish: 'satin' },
  },
  {
    source: 'sample', externalId: 'lip-003', brand: 'Rouge Lab',
    name: 'Liquid Lip Stain', category: 'lipstick', shadeName: 'Berry',
    imageUrl: 'https://placehold.co/400x400?text=Berry', price: 22, currency: 'USD',
    buyUrl: 'https://example.com/buy/lip-003', popularityScore: 70,
  },
  {
    source: 'sample', externalId: 'eye-001', brand: 'Lumi',
    name: 'Single Eyeshadow', category: 'eyeshadow', shadeName: 'Bronze',
    imageUrl: 'https://placehold.co/400x400?text=Bronze', price: 16, currency: 'USD',
    buyUrl: 'https://example.com/buy/eye-001', popularityScore: 92,
    shade: { hex: '#8C5A2B', region: 'eyes', finish: 'shimmer' },
  },
  {
    source: 'sample', externalId: 'eye-002', brand: 'Lumi',
    name: 'Single Eyeshadow', category: 'eyeshadow', shadeName: 'Taupe',
    imageUrl: 'https://placehold.co/400x400?text=Taupe', price: 16, currency: 'USD',
    buyUrl: 'https://example.com/buy/eye-002', popularityScore: 80,
    shade: { hex: '#7A6A5A', region: 'eyes', finish: 'matte' },
  },
  {
    source: 'sample', externalId: 'blush-001', brand: 'Petal',
    name: 'Powder Blush', category: 'blush', shadeName: 'Peach',
    imageUrl: 'https://placehold.co/400x400?text=Peach', price: 20, currency: 'USD',
    buyUrl: 'https://example.com/buy/blush-001', popularityScore: 85,
    shade: { hex: '#E8896B', region: 'cheeks', finish: 'satin' },
  },
  {
    source: 'sample', externalId: 'blush-002', brand: 'Petal',
    name: 'Cream Blush', category: 'blush', shadeName: 'Mauve',
    imageUrl: 'https://placehold.co/400x400?text=Mauve', price: 21, currency: 'USD',
    buyUrl: 'https://example.com/buy/blush-002', popularityScore: 60,
  },
  {
    source: 'sample', externalId: 'eye-003', brand: 'Glow Theory',
    name: 'Shimmer Eyeshadow', category: 'eyeshadow', shadeName: 'Champagne',
    imageUrl: 'https://placehold.co/400x400?text=Champagne', price: 17, currency: 'USD',
    buyUrl: 'https://example.com/buy/eye-003', popularityScore: 78,
  },
];

export class SampleFeedSource implements FeedSource {
  readonly source = 'sample';
  async fetchProducts(): Promise<NormalizedProduct[]> {
    return SAMPLE;
  }
}
