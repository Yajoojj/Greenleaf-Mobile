import { describe, expect, it, vi } from 'vitest';
import { PredictionError } from '../domain/errors';
import { HttpPredictionService, type HttpRequest, type HttpResponse, type HttpTransport } from './HttpPredictionService';

const okBody = JSON.stringify({
  probability: 0.42,
  model_probability: 0.7,
  hsv_probability: 0.3,
  class: 'Infectado',
  ratio: 0.06,
  severity: 'Moderada',
  processing_time_ms: 900,
  overlay: 'data:image/png;base64,iVBORw0KGgo=',
});

class FakeTransport implements HttpTransport {
  calls: HttpRequest[] = [];
  constructor(private readonly responses: Array<HttpResponse | Error | 'hang'>) {}
  send(req: HttpRequest): Promise<HttpResponse> {
    this.calls.push(req);
    const next = this.responses.shift() ?? { status: 500, body: '' };
    if (next === 'hang') {
      return new Promise((_, reject) => req.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))));
    }
    if (next instanceof Error) return Promise.reject(next);
    req.onUploaded?.();
    return Promise.resolve(next);
  }
}

const image = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' });

function service(transport: HttpTransport, extra: Partial<ConstructorParameters<typeof HttpPredictionService>[1]> = {}) {
  return new HttpPredictionService('https://api.example.com/', {
    transport,
    sleep: () => Promise.resolve(),
    isOnline: () => true,
    ...extra,
  });
}

async function kindOf(p: Promise<unknown>) {
  try {
    await p;
  } catch (e) {
    return e instanceof PredictionError ? e.kind : 'other';
  }
  return 'resolved';
}

describe('HttpPredictionService', () => {
  it('envia multipart com o campo "image" para /predict e valida a resposta', async () => {
    const tr = new FakeTransport([{ status: 200, body: okBody }]);
    const onUploaded = vi.fn();
    const r = await service(tr).predict(image, undefined, { onUploaded });
    expect(r.severity).toBe('Moderada');
    expect(tr.calls[0].url).toBe('https://api.example.com/predict');
    expect(tr.calls[0].method).toBe('POST');
    expect(tr.calls[0].body?.get('image')).toBeInstanceOf(Blob);
    expect(onUploaded).toHaveBeenCalledOnce();
  });

  it.each([
    [400, 'invalid_image'],
    [413, 'too_large'],
    [500, 'server'],
  ] as const)('HTTP %i → %s', async (status, kind) => {
    const tr = new FakeTransport([{ status, body: '{"detail":"x"}' }, { status, body: '{"detail":"x"}' }]);
    expect(await kindOf(service(tr).predict(image))).toBe(kind);
  });

  it('400/413 não são repetidos; 500 é repetido uma vez', async () => {
    const t400 = new FakeTransport([{ status: 400, body: '' }]);
    await kindOf(service(t400).predict(image));
    expect(t400.calls).toHaveLength(1);
    const t500 = new FakeTransport([{ status: 500, body: '' }, { status: 500, body: '' }]);
    await kindOf(service(t500).predict(image));
    expect(t500.calls).toHaveLength(2);
  });

  it('servidor dormindo (503) → nova tentativa com backoff e sucesso', async () => {
    const sleep = vi.fn(() => Promise.resolve());
    const tr = new FakeTransport([{ status: 503, body: '' }, { status: 200, body: okBody }]);
    const r = await service(tr, { sleep }).predict(image);
    expect(r.class).toBe('Infectado');
    expect(sleep).toHaveBeenCalledWith(1500, undefined);
  });

  it('servidor dormindo nas duas tentativas → "sleeping"', async () => {
    const tr = new FakeTransport([{ status: 502, body: '' }, { status: 504, body: '' }]);
    expect(await kindOf(service(tr).predict(image))).toBe('sleeping');
  });

  it('falha de rede → "network" após 1 retry', async () => {
    const tr = new FakeTransport([new TypeError('x'), new TypeError('x')]);
    expect(await kindOf(service(tr).predict(image))).toBe('network');
    expect(tr.calls).toHaveLength(2);
  });

  it('sem internet → "offline" sem chamar a rede', async () => {
    const tr = new FakeTransport([]);
    expect(await kindOf(service(tr, { isOnline: () => false }).predict(image))).toBe('offline');
    expect(tr.calls).toHaveLength(0);
  });

  it('resposta fora do contrato → "malformed"', async () => {
    const tr = new FakeTransport([{ status: 200, body: '{"class":"Saudável"}' }, { status: 200, body: '<html>' }]);
    expect(await kindOf(service(tr, { retries: 0 }).predict(image))).toBe('malformed');
  });

  it('tempo-limite → "timeout"', async () => {
    vi.useFakeTimers();
    const tr = new FakeTransport(['hang', 'hang']);
    const p = kindOf(service(tr, { timeoutMs: 1000, retries: 0 }).predict(image));
    await vi.advanceTimersByTimeAsync(1001);
    expect(await p).toBe('timeout');
    vi.useRealTimers();
  });

  it('cancelar → "cancelled" e não repete', async () => {
    const tr = new FakeTransport(['hang', 'hang']);
    const ctrl = new AbortController();
    const p = kindOf(service(tr).predict(image, ctrl.signal));
    ctrl.abort();
    expect(await p).toBe('cancelled');
    expect(tr.calls).toHaveLength(1);
  });

  it('health() valida GET /health', async () => {
    const tr = new FakeTransport([{ status: 200, body: '{"status":"ok","version":"1.0.0","environment":"production","model_loaded":false,"supabase_logging":false}' }]);
    const h = await service(tr).health();
    expect(h.model_loaded).toBe(false);
    expect(tr.calls[0].url).toBe('https://api.example.com/health');
  });
});
