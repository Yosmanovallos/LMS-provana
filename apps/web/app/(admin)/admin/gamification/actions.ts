'use server';

import { revalidatePath } from 'next/cache';
import { apiPost, apiPut } from '@/lib/api';

export async function updateRuleAction(ruleId: string, formData: FormData) {
  const points = Number(formData.get('points'));
  const capRaw = String(formData.get('dailyCapPerUser') ?? '').trim();
  await apiPut(`/gamification/rules/${ruleId}`, {
    points,
    ...(capRaw ? { dailyCapPerUser: Number(capRaw) } : {}),
  });
  revalidatePath('/admin/gamification');
}

export async function materializeLeaderboardsAction() {
  await apiPost('/gamification/materialize-leaderboards');
  revalidatePath('/admin/gamification');
  revalidatePath('/achievements');
}
