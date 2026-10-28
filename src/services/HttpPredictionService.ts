import { PredictionError } from '../domain/errors';
import { healthStatusSchema, predictionResultSchema } from '../domain/schemas';
import type { PredictionProgress, PredictionService } from '../domain/services';
import type { HealthStatus, PredictionResult } from '../domain/types';

export interface HttpRequest {
  method: 'GET' | 'POST';
  url: string;
  body?: FormData;
  signal: AbortSignal;
  onUploaded?: () => void;
}

export interface HttpResponse {
  status: number;
  /** Texto bruto; é validado antes de virar objeto. */
  body: string;
}

/** Camada de transporte injetável (XHR no navegador; falsa nos testes). */
export interface HttpTransport {
  send(req: HttpRequest): Promise<HttpResponse>;
}

/** XHR em vez de fetch: é o único jeito de saber quando o upload terminou (etapa "Enviando"). */
export class XhrTransport implements HttpTransport {
  send({ method, url, body, signal, onUploaded }: HttpRequest): Promise<HttpResponse> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open(method, url);
      xhr.setRequestHeader('Accept', 'application/json');
      xhr.responseType = 'text';
      const abort = () => xhr.abort();
      if (signal.aborted) return reject(new DOMException('Aborted', 'AbortError'));
      signal.addEventListener('abort', abort, { once: true });
      if (onUploaded) xhr.upload.addEventListener('load', () => onUploaded(), { once: true });
      xhr.onload = () => {
        signal.removeEventListener('abort', abort);
        resolve({ status: xhr.status, body: typeof xhr.response === 'string' ? xhr.response : '' });
      };
      xhr.onerror = () => {
        signal.removeEventListener('abort', abort);
        reject(new TypeError('network'));
      };
      xhr.onabort = () => reject(new DOMException('Aborted', 'AbortError'));
      xhr.send(body ?? null);
    });
  }
}

export interface HttpPredictionOptions {
  transport?: HttpTransport;
  /** Tempo máximo de uma tentativa. Alto porque a Render pode levar 30–60 s para acordar. */
  timeoutMs?: number;
  healthTimeoutMs?: number;
  /** Quantas novas tentativas após uma falha recuperável. */
  retries?: number;
  backoffMs?: number;
  isOnline?: () => boolean;
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
}

const RETRY_STATUSES = new Set([502, 503, 504]);

function defaultSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      reject(new DOMException('Aborted', 'AbortError'));
    }, { once: true });
  });
}

/** Cliente do Axios Cassava IA (`POST /predict`, `GET /health`). */
export class HttpPredictionService implements PredictionService {
  private readonly transport: HttpTransport;
  private readonly timeoutMs: number;
  private readonly healthTimeoutMs: number;
  private readonly retries: number;
  private readonly backoffMs: number;
  private readonly isOnline: () => boolean;
  private readonly sleep: (ms: number, signal?: AbortSignal) => Promise<void>;

  constructor(private readonly baseUrl: string, options: HttpPredictionOptions = {}) {
    this.transport = options.transport ?? new XhrTransport();
    this.timeoutMs = options.timeoutMs ?? 75_000;
    this.healthTimeoutMs = options.healthTimeoutMs ?? 12_000;
    this.retries = options.retries ?? 1;
    this.backoffMs = options.backoffMs ?? 1_500;
    this.isOnline = options.isOnline ?? (() => (typeof navigator === 'undefined' ? true : navigator.onLine));
    this.sleep = options.sleep ?? defaultSleep;
  }

  private url(path: string): string {
    return `${this.baseUrl.replace(/\/+$/, '')}${path}`;
  }

  async predict(file: Blob, signal?: AbortSignal, progress?: PredictionProgress): Promise<PredictionResult> {
    if (!this.isOnline()) throw new PredictionError('offline');
    let attempt = 0;
    for (;;) {
      try {
        return await this.predictOnce(file, signal, progress);
      } catch (err) {
        const e = err instanceof PredictionError ? err : new PredictionError('network');
        const canRetry = attempt < this.retries && ['sleeping', 'network', 'timeout', 'server'].includes(e.kind) && this.isOnline();
        if (!canRetry || signal?.aborted) throw e;
        attempt += 1;
        try {
          await this.sleep(this.backoffMs * attempt, signal);
        } catch {
          throw new PredictionError('cancelled');
        }
      }
    }
  }

  private async predictOnce(file: Blob, outer?: AbortSignal, progress?: PredictionProgress): Promise<PredictionResult> {
    const form = new FormData();
    const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
    form.append('image', file, type === 'image/png' ? 'folha.png' : 'folha.jpg');
    const res = await this.request({ method: 'POST', url: this.url('/predict'), body: form, onUploaded: progress?.onUploaded }, this.timeoutMs, outer);

    if (res.status === 200) {
      const parsed = predictionResultSchema.safeParse(safeJson(res.body));
      if (!parsed.success) throw new PredictionError('malformed');
      return parsed.data;
    }
    if (res.status === 400 || res.status === 422) throw new PredictionError('invalid_image');
    if (res.status === 413) throw new PredictionError('too_large');
    if (RETRY_STATUSES.has(res.status) || res.status === 0) throw new PredictionError('sleeping');
    throw new PredictionError('server');
  }

  async health(): Promise<HealthStatus> {
    if (!this.isOnline()) throw new PredictionError('offline');
    const res = await this.request({ method: 'GET', url: this.url('/health') }, this.healthTimeoutMs);
    if (RETRY_STATUSES.has(res.status)) throw new PredictionError('sleeping');
    if (res.status !== 200) throw new PredictionError('server');
    const parsed = healthStatusSchema.safeParse(safeJson(res.body));
    if (!parsed.success) throw new PredictionError('malformed');
    return parsed.data;
  }

  /** Envia com tempo-limite e repassa o cancelamento de quem chamou. */
  private async request(req: Omit<HttpRequest, 'signal'>, timeoutMs: number, outer?: AbortSignal): Promise<HttpResponse> {
    if (outer?.aborted) throw new PredictionError('cancelled');
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    const onOuterAbort = () => controller.abort();
    outer?.addEventListener('abort', onOuterAbort, { once: true });
    try {
      return await this.transport.send({ ...req, signal: controller.signal });
    } catch (err) {
      if (timedOut) throw new PredictionError('timeout');
      if (outer?.aborted || (err instanceof DOMException && err.name === 'AbortError')) throw new PredictionError('cancelled');
      throw new PredictionError(this.isOnline() ? 'network' : 'offline');
    } finally {
      clearTimeout(timer);
      outer?.removeEventListener('abort', onOuterAbort);
    }
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
