/** Browser-side helpers to normalize phone photos before upload. */

export type PreparedProgressPhoto = {
  file: File;
  previewUrl: string;
};

const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.82;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Bild „${file.name || "Foto"}“ konnte nicht gelesen werden.`));
    };
    image.src = url;
  });
}

async function canvasToJpeg(canvas: HTMLCanvasElement, name: string): Promise<File> {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => {
      if (!value) reject(new Error("Foto konnte nicht komprimiert werden."));
      else resolve(value);
    }, "image/jpeg", JPEG_QUALITY);
  });
  const base = name.replace(/\.[^.]+$/, "") || "progress";
  return new File([blob], `${base}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
}

export async function prepareProgressPhoto(file: File): Promise<File> {
  if (!file.type.startsWith("image/") && !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name)) {
    throw new Error(`„${file.name || "Datei"}“ ist kein Bild.`);
  }

  try {
    const image = await loadImage(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Foto konnte nicht vorbereitet werden.");
    context.drawImage(image, 0, 0, width, height);
    return canvasToJpeg(canvas, file.name);
  } catch (error) {
    if (file.type === "image/jpeg" || file.type === "image/jpg" || file.type === "image/png" || file.type === "image/webp") {
      if (file.size <= 8_000_000) return file;
    }
    throw error instanceof Error ? error : new Error("Foto konnte nicht vorbereitet werden.");
  }
}

export async function prepareProgressPhotos(files: FileList | File[]): Promise<PreparedProgressPhoto[]> {
  const list = [...files];
  if (!list.length) return [];
  if (list.length > 12) throw new Error("Maximal 12 Fotos auf einmal.");
  const prepared: PreparedProgressPhoto[] = [];
  for (const file of list) {
    const next = await prepareProgressPhoto(file);
    prepared.push({ file: next, previewUrl: URL.createObjectURL(next) });
  }
  return prepared;
}
