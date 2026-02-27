// Browser-side WebP conversion using Canvas API
// No external dependencies — runs entirely in the browser

export interface ConversionResult {
  blob: Blob;
  dataUrl: string;
  originalSize: number;
  convertedSize: number;
  width: number;
  height: number;
}

export async function convertToWebP(
  file: File,
  quality = 0.82,
  maxDimension = 1200
): Promise<ConversionResult> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { naturalWidth: w, naturalHeight: h } = img;
      if (w > maxDimension || h > maxDimension) {
        if (w >= h) {
          h = Math.round((h / w) * maxDimension);
          w = maxDimension;
        } else {
          w = Math.round((w / h) * maxDimension);
          h = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas 2D context unavailable'));
        return;
      }

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Canvas toBlob failed'));
            return;
          }
          const reader = new FileReader();
          reader.onload = () => {
            resolve({
              blob,
              dataUrl: reader.result as string,
              originalSize: file.size,
              convertedSize: blob.size,
              width: w,
              height: h,
            });
          };
          reader.readAsDataURL(blob);
        },
        'image/webp',
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image for conversion'));
    };

    img.src = objectUrl;
  });
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
