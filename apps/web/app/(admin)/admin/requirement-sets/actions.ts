'use server';

import { revalidatePath } from 'next/cache';
import { apiPost } from '@/lib/api';

function parseRequirements(raw: string): unknown {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error();
    return parsed;
  } catch {
    throw new Error(
      'Requirements must be a JSON array, e.g. [{"kind":"course","courseId":"…","label":"…","weight":10}]',
    );
  }
}

export async function createRequirementSetAction(formData: FormData) {
  await apiPost('/requirement-sets', {
    fromRoleLevel: {
      jobRoleId: String(formData.get('fromRole') ?? ''),
      jobLevelId: String(formData.get('fromLevel') ?? ''),
    },
    toRoleLevel: {
      jobRoleId: String(formData.get('toRole') ?? ''),
      jobLevelId: String(formData.get('toLevel') ?? ''),
    },
    requirements: parseRequirements(String(formData.get('requirements') ?? '[]')),
  });
  revalidatePath('/admin/requirement-sets');
}

export async function activateSetAction(setId: string) {
  await apiPost(`/requirement-sets/${setId}/activate`);
  revalidatePath('/admin/requirement-sets');
}

/** Editing an active set never mutates it — this creates v(n+1) (master plan invariant). */
export async function newVersionAction(setId: string, formData: FormData) {
  await apiPost(`/requirement-sets/${setId}/new-version`, {
    requirements: parseRequirements(String(formData.get('requirements') ?? '[]')),
  });
  revalidatePath('/admin/requirement-sets');
}
