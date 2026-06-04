'use server';

import { revalidatePath } from 'next/cache';
import { deleteSavedLook, deleteAllSavedLooks } from '@/lib/looks/looks';

export async function deleteLookAction(formData: FormData): Promise<void> {
  const id = formData.get('id');
  if (typeof id !== 'string' || !id) return;
  await deleteSavedLook(id);
  revalidatePath('/looks');
}

export async function deleteAllLooksAction(): Promise<void> {
  await deleteAllSavedLooks();
  revalidatePath('/looks');
}
