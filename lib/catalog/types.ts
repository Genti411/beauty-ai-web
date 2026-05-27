export const CATEGORIES = ['lipstick', 'eyeshadow', 'blush'] as const;
export type Category = (typeof CATEGORIES)[number];

export type ShadeData = {
  hex: string;
  region: 'lips' | 'eyes' | 'cheeks';
  finish?: string;
};

export type NormalizedProduct = {
  source: string;
  externalId: string;
  brand: string;
  name: string;
  category: Category;
  shadeName?: string;
  imageUrl?: string;
  price?: number;
  currency: string;
  buyUrl: string;
  popularityScore: number;
  shade?: ShadeData; // present only for try-on-enabled products
};
