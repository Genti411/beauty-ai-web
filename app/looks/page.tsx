import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getSavedLooks } from '@/lib/looks/looks';
import { LookCard } from './_components/look-card';
import { DeleteAllButton } from './_components/delete-all-button';

export default async function LooksPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const looks = await getSavedLooks();

  return (
    <main style={{ maxWidth: 960, margin: '32px auto', padding: '0 16px', display: 'grid', gap: 16 }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <h1 style={{ margin: 0 }}>Your looks</h1>
        {looks.length > 0 && <div style={{ marginLeft: 'auto' }}><DeleteAllButton /></div>}
      </header>
      {looks.length === 0 ? (
        <p>No saved looks yet. <Link href="/try-on">Try one on</Link>.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
          {looks.map((l) => <LookCard key={l.id} look={l} />)}
        </div>
      )}
    </main>
  );
}
