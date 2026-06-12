'use server';

import { revalidatePath } from 'next/cache';
import { apiPost } from '@/lib/api';

export async function submitEvidenceAction(formData: FormData) {
  const upload = formData.get('file');
  const description = String(formData.get('description') ?? '');
  const targetRequirementId = String(formData.get('targetRequirementId') ?? '').trim();
  const resubmissionOf = String(formData.get('resubmissionOf') ?? '').trim();

  if (!(upload instanceof File) || upload.size === 0) {
    throw new Error('Choose a file to attach as evidence');
  }
  // MVP local FileStoragePort stores text content; binary payloads keep metadata only.
  const content = await upload.text().catch(() => `<binary:${upload.name}>`);

  await apiPost('/evidence', {
    file: {
      fileName: upload.name,
      mime: upload.type || 'application/octet-stream',
      sizeBytes: upload.size,
      content,
    },
    description,
    ...(targetRequirementId ? { targetRequirementId } : {}),
    ...(resubmissionOf ? { resubmissionOf } : {}),
  });
  revalidatePath('/evidence');
}
