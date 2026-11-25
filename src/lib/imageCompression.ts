export interface CompressedImageResult {
  blob: Blob;
  previewUrl: string;
  originalBytes: number;
  compressedBytes: number;
  width: number;
  height: number;
  mimeType: 'image/webp' | 'image/jpeg';
}

const ALLOWED_INPUT_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_INPUT_BYTES = 12 * 1024 * 1024; // 12 MB raw input cap

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function loadImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Could not decode the selected image file.'));
    };
    img.src = objectUrl;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: 'image/webp' | 'image/jpeg',
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), mimeType, quality);
  });
}

/**
 * Compresses an image client-side using HTML5 Canvas prior to Firebase Storage upload.
 * Targets WebP (with JPEG fallback) under ~240 KB for fast Android mobile publishing.
 */
export async function compressImageFile(
  file: File,
  options?: { maxDimension?: number; targetBytes?: number }
): Promise<CompressedImageResult> {
  if (!ALLOWED_INPUT_TYPES.has(file.type)) {
    throw new Error('Please choose a JPEG, PNG, or WebP image.');
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error('Image is too large (max 12 MB before compression).');
  }

  const maxDimension = options?.maxDimension ?? 1280;
  const targetBytes = options?.targetBytes ?? 240 * 1024;

  const img = await loadImageElement(file);
  const scale = Math.min(1, maxDimension / Math.max(img.width, img.height, 1));
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Browser canvas is unavailable for image compression.');
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, width, height);

  // Try WebP first; fallback to JPEG if browser lacks WebP encoding
  let mimeType: 'image/webp' | 'image/jpeg' = 'image/webp';
  let quality = 0.82;
  let blob = await canvasToBlob(canvas, mimeType, quality);

  if (!blob || blob.type !== 'image/webp') {
    mimeType = 'image/jpeg';
    blob = await canvasToBlob(canvas, mimeType, quality);
  }

  // Step down quality gently until under targetBytes or floor quality
  while (blob && blob.size > targetBytes && quality > 0.45) {
    quality = Math.max(0.45, quality - 0.1);
    const nextBlob = await canvasToBlob(canvas, mimeType, quality);
    if (!nextBlob) break;
    blob = nextBlob;
  }

  if (!blob) {
    throw new Error('Image compression failed. Please try another photo.');
  }

  const previewUrl = URL.createObjectURL(blob);

  return {
    blob,
    previewUrl,
    originalBytes: file.size,
    compressedBytes: blob.size,
    width,
    height,
    mimeType,
  };
}
