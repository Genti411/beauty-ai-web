import Link from 'next/link';
import { parseCatalogQuery } from '@/lib/catalog/query';
import { getProducts } from '@/lib/catalog/products';
import { AffiliateDisclosure } from './_components/affiliate-disclosure';
import { ProductCard } from './_components/product-card';
import { CatalogFilters } from './_components/catalog-filters';

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; search?: string; page?: string }>;
}) {
  const params = await searchParams;
  const query = parseCatalogQuery(params);
  const { products, totalCount, page, pageSize } = await getProducts(query);
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  function pageHref(p: number) {
    const sp = new URLSearchParams();
    if (query.category) sp.set('category', query.category);
    if (query.search) sp.set('search', query.search);
    sp.set('page', String(p));
    return `/products?${sp.toString()}`;
  }

  return (
    <main style={{ maxWidth: 960, margin: '32px auto', padding: '0 16px' }}>
      <h1>Products</h1>
      <AffiliateDisclosure />
      <CatalogFilters activeCategory={query.category} search={query.search} />

      {products.length === 0 ? (
        <p>No products found.</p>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: 16,
          }}
        >
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <nav style={{ display: 'flex', gap: 12, marginTop: 24 }}>
          {page > 1 && <Link href={pageHref(page - 1)}>Previous</Link>}
          <span>Page {page} of {totalPages}</span>
          {page < totalPages && <Link href={pageHref(page + 1)}>Next</Link>}
        </nav>
      )}
    </main>
  );
}
