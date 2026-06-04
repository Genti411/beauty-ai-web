import { CATEGORIES, type Category } from './types';

export type CatalogQuery = {
  category?: Category;
  search?: string;
  page: number;
};

type RawParams = {
  category?: string;
  search?: string;
  page?: string;
};

export function parseCatalogQuery(params: RawParams): CatalogQuery {
  const category = CATEGORIES.includes(params.category as Category)
    ? (params.category as Category)
    : undefined;

  const search = params.search?.trim() ? params.search.trim() : undefined;

  const pageNum = Number(params.page);
  const page = Number.isFinite(pageNum) && pageNum >= 1 ? Math.floor(pageNum) : 1;

  return { category, search, page };
}
