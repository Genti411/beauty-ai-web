import { randomUUID } from 'node:crypto';
import { createClient } from '@/lib/supabase/server';
import { pathFor } from './path';
import { serializePicks, type SavedPick } from './picks';
import type { TryOnProduct } from '@/lib/catalog/tryon-products';

const BUCKET = 'look-images';
const SIGNED_URL_TTL = 60 * 60; // 1 hour

export type SavedLook = {
  id: string;
  imageUrl: string;
  picks: SavedPick[];
  createdAt: string;
};

type SavedLookRow = {
  id: string;
  image_path: string;
  picks: SavedPick[];
  created_at: string;
};

export async function saveLook(args: {
  userId: string;
  blob: Blob;
  picks: TryOnProduct[];
}): Promise<{ id: string }> {
  const supabase = await createClient();
  const lookId = randomUUID();
  const imagePath = pathFor(args.userId, lookId);

  const upload = await supabase.storage
    .from(BUCKET)
    .upload(imagePath, args.blob, { contentType: 'image/png', upsert: false });
  if (upload.error) throw upload.error;

  const { error } = await supabase
    .from('saved_looks')
    .insert({
      id: lookId,
      user_id: args.userId,
      image_path: imagePath,
      picks: serializePicks(args.picks),
    });
  if (error) {
    // Roll back the orphaned object on row-insert failure.
    await supabase.storage.from(BUCKET).remove([imagePath]);
    throw error;
  }
  return { id: lookId };
}

export async function getSavedLooks(): Promise<SavedLook[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('saved_looks')
    .select('id, image_path, picks, created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;

  const rows = (data ?? []) as SavedLookRow[];
  const looks: SavedLook[] = [];
  for (const r of rows) {
    const signed = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(r.image_path, SIGNED_URL_TTL);
    looks.push({
      id: r.id,
      imageUrl: signed.data?.signedUrl ?? '',
      picks: r.picks,
      createdAt: r.created_at,
    });
  }
  return looks;
}

export async function deleteSavedLook(lookId: string): Promise<void> {
  const supabase = await createClient();
  // Read first so we know the image path (RLS-scoped to owner).
  const { data, error: readError } = await supabase
    .from('saved_looks')
    .select('image_path')
    .eq('id', lookId)
    .maybeSingle();
  if (readError) throw readError;
  if (!data) return; // not found / not yours — nothing to do
  const path = (data as { image_path: string }).image_path;

  // Delete the row first so the UI never shows a card pointing at a missing
  // object. A failed storage removal afterwards only orphans bytes (best-effort).
  const { error: delError } = await supabase
    .from('saved_looks')
    .delete()
    .eq('id', lookId);
  if (delError) throw delError;

  await supabase.storage.from(BUCKET).remove([path]);
}

export async function deleteAllSavedLooks(): Promise<void> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('saved_looks').select('image_path');
  if (error) throw error;
  const paths = (data ?? []).map((r) => (r as { image_path: string }).image_path);
  // Delete the rows first (RLS scopes this to the current user); then remove the
  // objects best-effort, so a transient storage failure can't leave broken cards.
  const { error: delError } = await supabase
    .from('saved_looks')
    .delete()
    .not('id', 'is', null);
  if (delError) throw delError;

  if (paths.length > 0) {
    await supabase.storage.from(BUCKET).remove(paths);
  }
}
