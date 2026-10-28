import { PredictionError } from '../domain/errors';
import type { PredictionProgress, PredictionService } from '../domain/services';
import type { HealthStatus, PredictionResult } from '../domain/types';
import { RECORDED_CASES, wait, type RecordedCase } from './MockPredictionService';

export type DemoExample = Pick<RecordedCase, 'id' | 'image'>;

function readBytes(blob: Blob): Promise<Uint8Array> {
  if (typeof blob.arrayBuffer === 'function') return blob.arrayBuffer().then((b) => new Uint8Array(b));
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

async function sha256(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', Uint8Array.from(await readBytes(blob)));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/**
 * Modo demonstração: devolve as respostas gravadas para as 4 folhas de exemplo,
 * reconhecidas pelo conteúdo (SHA-256). Tudo vem do cache do service worker,
 * então funciona em modo avião. Qualquer outra foto vai para o `fallback`.
 */
export class DemoPredictionService implements PredictionService {
  static readonly examples: DemoExample[] = RECORDED_CASES.map(({ id, image }) => ({ id, image }));

  private hashes?: Promise<Map<string, RecordedCase>>;

  constructor(
    private readonly fallback: PredictionService,
    private readonly delayMs = 1400,
    private readonly fetchImpl: typeof fetch = (...args) => fetch(...args),
  ) {}

  private index(): Promise<Map<string, RecordedCase>> {
    this.hashes ??= Promise.all(
      RECORDED_CASES.map(async (c) => [await sha256(await (await this.fetchImpl(c.image)).blob()), c] as const),
    ).then((pairs) => new Map(pairs));
    return this.hashes;
  }

  async predict(file: Blob, signal?: AbortSignal, progress?: PredictionProgress): Promise<PredictionResult> {
    let match: RecordedCase | undefined;
    try {
      match = (await this.index()).get(await sha256(file));
    } catch {
      match = undefined;
    }
    if (!match) return this.fallback.predict(file, signal, progress);

    await wait(this.delayMs * 0.35, signal);
    progress?.onUploaded?.();
    await wait(this.delayMs * 0.65, signal);
    try {
      const overlayBlob = await (await this.fetchImpl(match.response.overlay)).blob();
      return { ...match.response, overlay: await blobToDataUrl(overlayBlob) };
    } catch {
      throw new PredictionError('server');
    }
  }

  async health(): Promise<HealthStatus> {
    return { status: 'ok', version: 'demo', environment: 'demo', model_loaded: false, supabase_logging: false };
  }
}
