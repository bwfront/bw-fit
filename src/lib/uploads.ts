import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

export const PROGRESS_PHOTO_MAX_BYTES = 4_500_000;
export const PROGRESS_PHOTO_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export type ProgressPhotoMime = keyof typeof PROGRESS_PHOTO_TYPES;

export function getUploadRoot(): string {
  return process.env.UPLOAD_PATH ?? resolve(process.cwd(), "uploads");
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
  if (!(mime in PROGRESS_PHOTO_TYPES)) return null;
  return PROGRESS_PHOTO_TYPES[mime as ProgressPhotoMime];
}
