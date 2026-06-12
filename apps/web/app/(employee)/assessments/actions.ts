'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { api, apiPost } from '@/lib/api';
import { AssessmentView } from '@/lib/types';

/** Starts an attempt and submits the answers built from the question form. */
export async function takeAssessmentAction(assessmentId: string, formData: FormData) {
  const assessment = await api<AssessmentView | null>(`/assessments/${assessmentId}`);
  if (!assessment) redirect('/assessments');

  const answers = assessment.questions.map((q) => {
    if (q.kind === 'multiple-choice') {
      const selected = formData.getAll(`q:${q.id}`).map((v) => Number(v));
      return { questionId: q.id, value: selected };
    }
    return { questionId: q.id, value: String(formData.get(`q:${q.id}`) ?? '') };
  });

  const { attemptId } = await apiPost<{ attemptId: string }>(`/assessments/${assessmentId}/attempts`);
  await apiPost(`/attempts/${attemptId}/submit`, { answers });

  revalidatePath('/assessments');
  redirect('/assessments?submitted=1');
}
