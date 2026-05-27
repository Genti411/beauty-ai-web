import { getTryOnProducts } from '@/lib/catalog/tryon-products';
import { TryOnStudio } from './_components/tryon-studio';

export default async function TryOnPage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string }>;
}) {
  const { product } = await searchParams;
  const products = await getTryOnProducts();
  return <TryOnStudio products={products} initialProductId={product} />;
}
