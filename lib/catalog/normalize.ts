import { CATEGORIES, type Category, type NormalizedProduct } from './types';

type RawProduct = Record<string, unknown>;

function asString(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() !== '' ? v : undefined;
}

function asNumber(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

// Maps a raw feed row to a NormalizedProduct, or returns null if it is missing
// required fields or has an unknown category (the caller skips nulls).
//
// Note: the try-on `shade` (hex/region/finish) is intentionally NOT derived
// here. Real affiliate feeds don't carry structured shade data, so the try-on
// shade is curated and attached by the FeedSource after normalization (as
// SampleFeedSource does). Adapters with shade data should set it themselves.
export function normalizeProduct(raw: RawProduct): NormalizedProduct | null {
  const source = asString(raw.source);
  const externalId = asString(raw.external_id);
  const brand = asString(raw.brand);
  const name = asString(raw.name);
  const category = asString(raw.category);
  const buyUrl = asString(raw.buy_url);

  if (!source || !externalId || !brand || !name || !category || !buyUrl) return null;
  if (!CATEGORIES.includes(category as Category)) return null;

  return {
    source,
    externalId,
    brand,
    name,
    category: category as Category,
    shadeName: asString(raw.shade_name),
    imageUrl: asString(raw.image_url),
    price: asNumber(raw.price),
    currency: asString(raw.currency) ?? 'USD',
    buyUrl,
    popularityScore: asNumber(raw.popularity_score) ?? 0,
  };
}
