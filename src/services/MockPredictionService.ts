import { PredictionError } from '../domain/errors';
import type { PredictionProgress, PredictionService } from '../domain/services';
import type { HealthStatus, PredictionResult } from '../domain/types';
import { analyseColors, classifySeverity, paintOverlay } from './colorAnalysis';
import demoCases from './fixtures/demo-cases.json';

/** Respostas reais da IA v2 gravadas (overlay como caminho do arquivo JPEG em /public/demo). */
export interface RecordedCase {
  id: string;
  image: string;
  response: Omit<PredictionResult, 'overlay'> & { overlay: string };
}

export const RECORDED_CASES = demoCases as RecordedCase[];

export type PixelAnalyser = (file: Blob) => Promise<PredictionResult>;

export interface MockOptions {
  /** Atraso total simulado (ms). */
  delayMs?: number;
  /** Substitui a análise de pixels (útil em testes). */
  analyser?: PixelAnalyser;
}

export function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new PredictionError('cancelled'));
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      reject(new PredictionError('cancelled'));
    }, { once: true });
  });
}

/** Análise de cor local, com o mesmo formato de resposta do servidor. */
export async function canvasAnalyser(file: Blob): Promise<PredictionResult> {
  const started = performance.now();
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new PredictionError('invalid_image');
  });
  const max = 480;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new PredictionError('server');
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const img = ctx.getImageData(0, 0, w, h);
  const analysis = analyseColors(img.data, w, h);
  paintOverlay(img.data, analysis);
  ctx.putImageData(img, 0, 0);

  const ratio = analysis.ratio;
  const hsv = Math.min(ratio / 0.2, 1);
  return {
    probability: hsv,
    model_probability: null,
    hsv_probability: hsv,
    class: ratio >= 0.02 || hsv >= 0.45 ? 'Infectado' : 'Saudavel',
    ratio,
    severity: classifySeverity(ratio),
    processing_time_ms: Math.round(performance.now() - started),
    overlay: canvas.toDataURL('image/png'),
  };
}

/**
 * Substituto do servidor enquanto VITE_API_URL não existe.
 * Responde no formato real; o resultado vem de uma aproximação local da análise de cor
 * e é sempre marcado como "simulado" na tela.
 */
export class MockPredictionService implements PredictionService {
  private readonly delayMs: number;
  private readonly analyser: PixelAnalyser;

  constructor(options: MockOptions = {}) {
    this.delayMs = options.delayMs ?? 1600;
    this.analyser = options.analyser ?? canvasAnalyser;
  }

  async predict(file: Blob, signal?: AbortSignal, progress?: PredictionProgress): Promise<PredictionResult> {
    await wait(this.delayMs * 0.35, signal);
    progress?.onUploaded?.();
    const [result] = await Promise.all([this.analyser(file), wait(this.delayMs * 0.65, signal)]);
    return result;
  }

  async health(): Promise<HealthStatus> {
    return { status: 'ok', version: 'mock', environment: 'mock', model_loaded: false, supabase_logging: false };
  }
}
