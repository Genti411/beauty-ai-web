import Link from 'next/link';
import { CATEGORIES, type Category } from '@/lib/catalog/types';

export function CatalogFilters({
  activeCategory,
  search,
}: {
  activeCategory?: Category;
  search?: string;
}) {
  return (
    <div style={{ display: 'grid', gap: 12, marginBottom: 16 }}>
      <form method="get" style={{ display: 'flex', gap: 8 }}>
        <input name="search" placeholder="Search products" defaultValue={search ?? ''} />
        {activeCategory && <input type="hidden" name="category" value={activeCategory} />}
        <button type="submit">Search</button>
      </form>
      <nav style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Link href="/products" style={{ fontWeight: activeCategory ? 'normal' : 'bold' }}>
          All
        </Link>
        {CATEGORIES.map((c) => (
          <Link
            key={c}
            href={`/products?category=${c}`}
            style={{ fontWeight: activeCategory === c ? 'bold' : 'normal' }}
          >
            {c}
          </Link>
        ))}
      </nav>
    </div>
  );
}
