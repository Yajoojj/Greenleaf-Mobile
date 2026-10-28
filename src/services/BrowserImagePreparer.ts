import { PredictionError } from '../domain/errors';
import type { ImagePreparer } from '../domain/services';

export const ACCEPTED_TYPES = ['image/jpeg', 'image/png'] as const;
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // igual ao MAX_UPLOAD_MB do servidor
export const MIN_SIDE_PX = 224; // entrada da EfficientNet; abaixo disso a foto é inútil

export interface PrepareOptions {
  maxSide?: number;
  quality?: number;
}

/**
 * Valida e prepara a foto antes do envio (RNF1 — app leve):
 * - aceita só JPEG/PNG até 8 MB;
 * - aplica a rotação do EXIF, reduz o lado maior para 1280 px e recomprime em JPEG;
 * - a recompressão via canvas descarta TODOS os metadados EXIF, inclusive GPS.
 */
export class BrowserImagePreparer implements ImagePreparer {
  constructor(private readonly options: PrepareOptions = {}) {}

  validate(file: Blob): void {
    // Alguns Androids entregam "image/jpg"; tratamos como JPEG.
    const type = file.type === 'image/jpg' ? 'image/jpeg' : file.type;
    if (!(ACCEPTED_TYPES as readonly string[]).includes(type)) throw new PredictionError('invalid_format');
    if (file.size > MAX_UPLOAD_BYTES) throw new PredictionError('too_large');
    if (file.size === 0) throw new PredictionError('low_quality');
  }

  async prepare(file: Blob): Promise<Blob> {
    this.validate(file);
    const maxSide = this.options.maxSide ?? 1280;
    const quality = this.options.quality ?? 0.82;

    let bitmap: ImageBitmap;
    try {
      bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      throw new PredictionError('low_quality');
    }
    try {
      const { width, height } = bitmap;
      if (Math.min(width, height) < MIN_SIDE_PX) throw new PredictionError('low_quality');
      const scale = Math.min(1, maxSide / Math.max(width, height));
      const w = Math.round(width * scale);
      const h = Math.round(height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new PredictionError('low_quality');
      ctx.drawImage(bitmap, 0, 0, w, h);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
      if (!blob) throw new PredictionError('low_quality');
      return blob;
    } finally {
      bitmap.close();
    }
  }

  toDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }
}
