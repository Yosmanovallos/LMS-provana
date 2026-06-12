'use server';

import { revalidatePath } from 'next/cache';
import { apiPost } from '@/lib/api';

export async function markReadAction(notificationId: string) {
  await apiPost(`/notifications/${notificationId}/read`);
  revalidatePath('/notifications');
}
