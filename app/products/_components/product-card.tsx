import type { ProductCard as Product } from '@/lib/catalog/products';

export function ProductCard({ product }: { product: Product }) {
  return (
    <article style={{ border: '1px solid #eee', borderRadius: 8, padding: 12, display: 'grid', gap: 6 }}>
      {product.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- external retailer images, no next/image loader configured
        <img src={product.imageUrl} alt={product.name} width={200} height={200} style={{ objectFit: 'cover', borderRadius: 6 }} />
      ) : (
        <div style={{ width: 200, height: 200, background: '#f4f4f4', borderRadius: 6 }} aria-hidden />
      )}
      <strong>{product.brand}</strong>
      <span>{product.name}</span>
      {product.shadeName && <span style={{ color: '#666' }}>{product.shadeName}</span>}
      {product.price !== undefined && (
        <span>{product.currency} {product.price.toFixed(2)}</span>
      )}
      <a href={product.buyUrl} target="_blank" rel="sponsored nofollow noopener">
        Shop
      </a>
    </article>
  );
}
