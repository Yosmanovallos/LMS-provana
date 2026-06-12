export interface StoredFileRef {
  storageKey: string;
  mime: string;
  sizeBytes: number;
  checksum: string;
}

export interface UploadRequest {
  fileName: string;
  mime: string;
  sizeBytes: number;
  /** base64 content for the local adapter; cloud adapters use signed URLs instead. */
  content?: string;
}

/** Evidence/certificate file storage. MVP: Cloudinary; Azure: Blob SAS. */
export interface FileStoragePort {
  store(request: UploadRequest): StoredFileRef;
  /** Short-lived signed download URL, authorization checked by the caller. */
  downloadUrl(storageKey: string): string;
}

export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/png',
  'image/jpeg',
] as const;

export const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;
