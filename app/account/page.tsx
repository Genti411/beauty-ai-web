import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function AccountPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .maybeSingle();

  async function signOut() {
    'use server';
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect('/');
  }

  const displayName = (profile as { display_name: string | null } | null)?.display_name;

  return (
    <main style={{ maxWidth: 480, margin: '64px auto', display: 'grid', gap: 12 }}>
      <h1>Welcome{displayName ? `, ${displayName}` : ''}</h1>
      <p style={{ color: '#666' }}>{user.email}</p>
      <form action={signOut}>
        <button type="submit">Sign out</button>
      </form>
    </main>
  );
}
