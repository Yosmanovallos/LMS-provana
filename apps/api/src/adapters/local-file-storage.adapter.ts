import { createHash } from 'node:crypto';
import {
  ALLOWED_MIME_TYPES,
  FileStoragePort,
  MAX_FILE_SIZE_BYTES,
  StoredFileRef,
  UploadRequest,
} from '../ports/file-storage.port';
import { IdPort } from '../ports/system.port';

/** In-memory/local storage adapter — Cloudinary (MVP) and Blob SAS (Azure) replace this. */
export class LocalFileStorageAdapter implements FileStoragePort {
  private files = new Map<string, UploadRequest>();

  constructor(private readonly ids: IdPort) {}

  store(request: UploadRequest): StoredFileRef {
    if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(request.mime)) {
      throw new Error(`Mime type not allowed: ${request.mime}`);
    }
    if (request.sizeBytes <= 0 || request.sizeBytes > MAX_FILE_SIZE_BYTES) {
      throw new Error(`File size out of bounds: ${request.sizeBytes}`);
    }
    const storageKey = `local/${this.ids.next()}/${request.fileName}`;
    this.files.set(storageKey, request);
    return {
      storageKey,
      mime: request.mime,
      sizeBytes: request.sizeBytes,
      checksum: createHash('sha256')
        .update(request.content ?? `${request.fileName}:${request.sizeBytes}`)
        .digest('hex'),
    };
  }

  downloadUrl(storageKey: string): string {
    return `/files/${encodeURIComponent(storageKey)}?signed=dev`;
  }
}
