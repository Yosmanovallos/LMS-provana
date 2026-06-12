'use server';

import { revalidatePath } from 'next/cache';
import { apiPost } from '@/lib/api';

export async function startEvidenceReviewAction(evidenceId: string) {
  await apiPost(`/evidence/${evidenceId}/start-review`);
  revalidatePath('/review/evidence');
}

export async function approveEvidenceAction(evidenceId: string, formData: FormData) {
  const note = String(formData.get('note') ?? '').trim();
  await apiPost(`/evidence/${evidenceId}/approve`, note ? { note } : {});
  revalidatePath('/review/evidence');
  revalidatePath('/readiness');
}

export async function rejectEvidenceAction(evidenceId: string, formData: FormData) {
  const feedback = String(formData.get('feedback') ?? '').trim();
  await apiPost(`/evidence/${evidenceId}/reject`, { feedback });
  revalidatePath('/review/evidence');
}

export async function reviewAttemptAction(attemptId: string, formData: FormData) {
  const manualScores: { questionId: string; points: number }[] = [];
  for (const [key, value] of formData.entries()) {
    if (key.startsWith('score:')) {
      manualScores.push({ questionId: key.slice('score:'.length), points: Number(value) });
    }
  }
  const feedback = String(formData.get('feedback') ?? '').trim();
  await apiPost(`/attempts/${attemptId}/review`, {
    manualScores,
    ...(feedback ? { feedback } : {}),
  });
  revalidatePath('/review/assessments');
  revalidatePath('/readiness');
}

export async function recognizeAction(userId: string) {
  await apiPost('/gamification/recognize', { userId });
  revalidatePath('/team');
}
