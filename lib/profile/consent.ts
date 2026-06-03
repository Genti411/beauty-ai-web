import { createClient } from '@/lib/supabase/server';

// Just the field this helper reads — accept anything wider.
export type ConsentRow = { saved_looks_consented_at?: string | null };

export function hasSavedLooksConsent(profile: ConsentRow): boolean {
  return !!profile.saved_looks_consented_at;
}

export async function recordSavedLooksConsent(userId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('profiles')
    .update({ saved_looks_consented_at: new Date().toISOString() })
    .eq('id', userId);
  if (error) throw error;
}
