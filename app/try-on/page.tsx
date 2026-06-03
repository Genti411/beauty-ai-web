import { createClient } from '@/lib/supabase/server';
import { getTryOnProducts } from '@/lib/catalog/tryon-products';
import { hasSavedLooksConsent } from '@/lib/profile/consent';
import { TryOnStudio } from './_components/tryon-studio';

export default async function TryOnPage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string }>;
}) {
  const { product } = await searchParams;
  const products = await getTryOnProducts();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let consented = false;
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('saved_looks_consented_at')
      .eq('id', user.id)
      .maybeSingle();
    consented = hasSavedLooksConsent(
      (profile as { saved_looks_consented_at: string | null } | null) ?? {},
    );
  }

  return (
    <TryOnStudio
      products={products}
      initialProductId={product}
      currentUserId={user?.id ?? null}
      initialHasConsent={consented}
    />
  );
}
