'use server';

import { revalidatePath } from 'next/cache';
import { apiPost } from '@/lib/api';

/** One module; one lesson per non-empty line of the textarea. */
export async function createCourseAction(formData: FormData) {
  const title = String(formData.get('title') ?? '').trim();
  const lessons = String(formData.get('lessons') ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => ({ title: line, type: 'video' as const, durationMin: 15 }));

  await apiPost('/catalog/courses', { title, modules: [{ title: 'Module 1', lessons }] });
  revalidatePath('/admin/catalog');
}

export async function publishCourseAction(courseId: string) {
  await apiPost(`/catalog/courses/${courseId}/publish`);
  revalidatePath('/admin/catalog');
}

export async function publishPathAction(pathId: string) {
  await apiPost(`/catalog/paths/${pathId}/publish`);
  revalidatePath('/admin/catalog');
}

/** Items as JSON, e.g. [{"kind":"course","refId":"…"},{"kind":"assessment","refId":"…"}] */
export async function createPathAction(formData: FormData) {
  const title = String(formData.get('title') ?? '').trim();
  const jobRoleId = String(formData.get('jobRoleId') ?? '').trim();
  const jobLevelId = String(formData.get('jobLevelId') ?? '').trim();
  let items: unknown;
  try {
    items = JSON.parse(String(formData.get('items') ?? '[]'));
  } catch {
    throw new Error('Items must be valid JSON: [{"kind":"course","refId":"<id>"}, …]');
  }
  await apiPost('/catalog/paths', {
    title,
    items,
    ...(jobRoleId && jobLevelId ? { targetRoleLevel: { jobRoleId, jobLevelId } } : {}),
  });
  revalidatePath('/admin/catalog');
}
