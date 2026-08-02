import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { getProgressPhoto } from "@/lib/data";
import { getSession } from "@/lib/session";
import { isSafeProgressPhotoFileName, progressPhotoFilePath } from "@/lib/uploads";

export const dynamic = "force-dynamic";

const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const { id } = await context.params;
  const photo = getProgressPhoto(id);
  if (!photo || !isSafeProgressPhotoFileName(photo.fileName)) return new Response("Not found", { status: 404 });

  const filePath = progressPhotoFilePath(photo.fileName);
  if (!existsSync(filePath)) return new Response("Not found", { status: 404 });

  const extension = photo.fileName.split(".").pop()?.toLowerCase() ?? "jpg";
  const bytes = await readFile(filePath);
  return new Response(bytes, {
    headers: {
      "content-type": CONTENT_TYPES[extension] ?? "application/octet-stream",
      "cache-control": "private, max-age=31536000, immutable",
    },
  });
}
