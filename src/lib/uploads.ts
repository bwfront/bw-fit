import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

export const PROGRESS_PHOTO_MAX_BYTES = 8_000_000;
export const PROGRESS_PHOTO_TYPES = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "jpg",
  "image/heif": "jpg",
} as const;

export type ProgressPhotoMime = keyof typeof PROGRESS_PHOTO_TYPES;

export function getUploadRoot(): string {
  if (process.env.UPLOAD_PATH) return process.env.UPLOAD_PATH;
  const databasePath = process.env.DATABASE_PATH ?? resolve(process.cwd(), "data/kraftbuch.sqlite");
  return resolve(dirname(databasePath), "uploads");
}

export function getProgressPhotoDir(): string {
  const dir = resolve(getUploadRoot(), "progress");
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function progressPhotoFilePath(fileName: string): string {
  return resolve(getProgressPhotoDir(), fileName);
}

export function isSafeProgressPhotoFileName(fileName: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$/i.test(fileName);
}

export function extensionForMime(mime: string): string | null {
  const normalized = mime.toLowerCase().trim();
  if (!(normalized in PROGRESS_PHOTO_TYPES)) return null;
  return PROGRESS_PHOTO_TYPES[normalized as ProgressPhotoMime];
}

export function extensionFromFileName(fileName: string): string | null {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".heic") || lower.endsWith(".heif")) return "jpg";
  if (lower.endsWith(".png")) return "png";
  if (lower.endsWith(".webp")) return "webp";
  return null;
}

export function extensionFromMagicBytes(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "png";
  if (bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
    && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return "webp";
  return null;
}

export function resolveProgressPhotoExtension(file: { type: string; name: string }, bytes?: Uint8Array): string | null {
  return extensionForMime(file.type)
    ?? extensionFromFileName(file.name)
    ?? (bytes ? extensionFromMagicBytes(bytes) : null);
}
