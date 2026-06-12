'use server';

import { revalidatePath } from 'next/cache';
import { apiPost } from '@/lib/api';

export async function completeLessonAction(enrollmentId: string, lessonId: string, coursePath: string) {
  await apiPost(`/enrollments/${enrollmentId}/lessons/${lessonId}/complete`);
  revalidatePath(coursePath);
  revalidatePath('/my-learning');
}

export async function enrollAction(targetKind: string, targetId: string) {
  await apiPost('/enrollments', { targetKind, targetId });
  revalidatePath('/catalog');
  revalidatePath('/my-learning');
  revalidatePath(`/courses/${targetId}`);
}
