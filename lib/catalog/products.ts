import { createClient } from '@/lib/supabase/server';
import type { CatalogQuery } from './query';

export const PAGE_SIZE = 24;

export type ProductCard = {
  id: string;
  brand: string;
  name: string;
  category: string;
  shadeName?: string;
  imageUrl?: string;
  price?: number;
  currency: string;
  buyUrl: string;
};

type ProductRow = {
  id: string;
  brand: string;
  name: string;
  category: string;
  shade_name: string | null;
  image_url: string | null;
  price: number | null;
  currency: string;
  buy_url: string;
};

export function rowToCard(row: ProductRow): ProductCard {
  return {
    id: row.id,
    brand: row.brand,
    name: row.name,
    category: row.category,
    shadeName: row.shade_name ?? undefined,
    imageUrl: row.image_url ?? undefined,
    price: row.price ?? undefined,
    currency: row.currency,
    buyUrl: row.buy_url,
  };
}

export type CatalogResult = {
  products: ProductCard[];
  totalCount: number;
  page: number;
  pageSize: number;
};

export async function getProducts(query: CatalogQuery): Promise<CatalogResult> {
  const supabase = await createClient();

  let q = supabase
    .from('products')
    .select(
      'id, brand, name, category, shade_name, image_url, price, currency, buy_url',
      { count: 'exact' },
    );

  if (query.category) q = q.eq('category', query.category);
  if (query.search) q = q.ilike('name', `%${query.search}%`);

  const from = (query.page - 1) * PAGE_SIZE;
  q = q.order('popularity_score', { ascending: false }).range(from, from + PAGE_SIZE - 1);

  const { data, error, count } = await q;
  if (error) throw error;

  return {
    products: (data ?? []).map((r) => rowToCard(r as ProductRow)),
    totalCount: count ?? 0,
    page: query.page,
    pageSize: PAGE_SIZE,
  };
}
