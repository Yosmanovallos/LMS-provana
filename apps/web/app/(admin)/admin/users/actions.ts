'use server';

import { revalidatePath } from 'next/cache';
import { apiPost } from '@/lib/api';

export async function registerUserAction(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim();
  const displayName = String(formData.get('displayName') ?? '').trim();
  const role = String(formData.get('role') ?? 'employee');
  await apiPost('/users', { externalAuthId: `dev|${email}`, email, displayName, role });
  revalidatePath('/admin/users');
}

export async function assignRoleAction(userId: string, formData: FormData) {
  await apiPost(`/users/${userId}/role`, { role: String(formData.get('role')) });
  revalidatePath('/admin/users');
}

export async function assignManagerAction(userId: string, formData: FormData) {
  await apiPost(`/org/profiles/${userId}/manager`, { managerId: String(formData.get('managerId')) });
  revalidatePath('/admin/users');
}

export async function changeJobLevelAction(userId: string, formData: FormData) {
  await apiPost(`/org/profiles/${userId}/job-level`, {
    jobRoleId: String(formData.get('jobRoleId')),
    jobLevelId: String(formData.get('jobLevelId')),
  });
  revalidatePath('/admin/users');
}
