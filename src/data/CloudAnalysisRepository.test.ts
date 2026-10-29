import { describe, expect, it, vi } from 'vitest';
import { analysis } from '../test/utils';
import { fakeSupabase, op, type QueryCall } from '../test/fakeSupabase';
import { CloudAnalysisRepository, CloudRejectedError } from './CloudAnalysisRepository';

const jpeg = vi.fn(async (b: Blob) => new Blob([b], { type: 'image/jpeg' }));
const probs = { CBB: 0.6, CBSD: 0.1, CGM: 0.05, CMD: 0.15, Healthy: 0.1 };

const row = {
  id: 'a1',
  user_id: 'user-1',
  created_at: '2026-10-20T13:30:00.000Z',
  state: 'moderada',
  probability: 0.42,
  model_probability: 0.7,
  hsv_probability: 0.3,
  ratio: 0.078,
  severity: 'Moderada',
  other_disease: null,
  class_probabilities: probs,
  model_version: 'greenleaf_effb0-2026-10-28',
  processing_time_ms: 800,
  source: 'camera',
  image_path: 'user-1/a1/original.jpg',
  overlay_path: 'user-1/a1/overlay.jpg',
  locations: { latitude: -24.49, longitude: -47.84 },
};

describe('CloudAnalysisRepository', () => {
  it('save: envia foto e overlay em JPEG para {user_id}/{id}/, insere a linha (idempotente) e a localização arredondada', async () => {
    const f = fakeSupabase();
    const repo = new CloudAnalysisRepository(f.client, jpeg);
    await repo.save(analysis({ classProbabilities: probs, modelVersion: 'v2', source: 'camera', latitude: -24.4912, longitude: -47.8449 }));

    expect(f.storage.upload.mock.calls.map((c) => c[0])).toEqual(['user-1/a1/original.jpg', 'user-1/a1/overlay.jpg']);
    expect(f.storage.upload.mock.calls.every((c) => (c[2] as { contentType: string }).contentType === 'image/jpeg')).toBe(true);
    expect(jpeg).toHaveBeenCalledTimes(2);

    const [analyses, locations] = f.calls;
    expect(analyses.table).toBe('analyses');
    const [inserted, options] = op(analyses, 'upsert')!.args as [Record<string, unknown>, unknown];
    expect(options).toEqual({ onConflict: 'id', ignoreDuplicates: true });
    expect(inserted).toMatchObject({
      id: 'a1',
      user_id: 'user-1',
      created_at: '2026-10-20T13:30:00.000Z',
      state: 'moderada',
      severity: 'Moderada',
      class_probabilities: probs,
      model_version: 'v2',
      source: 'camera',
      image_path: 'user-1/a1/original.jpg',
      overlay_path: 'user-1/a1/overlay.jpg',
    });
    expect(locations.table).toBe('locations');
    expect(op(locations, 'upsert')!.args[0]).toEqual({ analysis_id: 'a1', latitude: -24.49, longitude: -47.84, consent: true });
  });

  it('save: folha sadia nunca leva severidade; sem localização não grava em locations', async () => {
    const f = fakeSupabase();
    await new CloudAnalysisRepository(f.client, jpeg).save(analysis({ state: 'sadia', severity: 'Leve', otherDisease: 'CMD', source: 'gallery' }));
    expect(f.calls).toHaveLength(1);
    expect(op(f.calls[0], 'upsert')!.args[0]).toMatchObject({ severity: null, other_disease: 'CMD', source: 'gallery' });
  });

  it('save: demonstração e resultado simulado nunca vão para a nuvem', async () => {
    const f = fakeSupabase();
    const repo = new CloudAnalysisRepository(f.client, jpeg);
    await expect(repo.save(analysis({ source: 'demo' }))).rejects.toBeInstanceOf(CloudRejectedError);
    await expect(repo.save(analysis({ simulated: true }))).rejects.toBeInstanceOf(CloudRejectedError);
    expect(f.storage.upload).not.toHaveBeenCalled();
    expect(f.calls).toHaveLength(0);
  });

  it('save: arquivo já enviado (reenvio da fila) não é erro; restrição do banco é recusa definitiva; rede é erro comum', async () => {
    const dup = fakeSupabase();
    dup.storage.upload.mockResolvedValue({ data: null as never, error: { statusCode: '409', message: 'The resource already exists' } });
    await expect(new CloudAnalysisRepository(dup.client, jpeg).save(analysis())).resolves.toBeTruthy();

    const check = fakeSupabase({ respond: () => ({ error: { code: '23514', message: 'check' } }) });
    await expect(new CloudAnalysisRepository(check.client, jpeg).save(analysis())).rejects.toBeInstanceOf(CloudRejectedError);

    const offline = fakeSupabase({ respond: () => ({ error: { code: '', message: 'TypeError: Failed to fetch' } }) });
    const err = await new CloudAnalysisRepository(offline.client, jpeg).save(analysis()).catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(CloudRejectedError);
  });

  it('save sem login recusa', async () => {
    await expect(new CloudAnalysisRepository(fakeSupabase({ session: null }).client, jpeg).save(analysis())).rejects.toThrow('not_signed_in');
  });

  it('list: monta Analysis com URLs assinadas curtas nos mesmos campos das telas', async () => {
    const f = fakeSupabase({ respond: () => ({ data: [row], error: null }) });
    const [a] = await new CloudAnalysisRepository(f.client, jpeg).list({ state: 'moderada' });
    expect(op(f.calls[0], 'eq')!.args).toEqual(['state', 'moderada']);
    expect(op(f.calls[0], 'order')!.args).toEqual(['created_at', { ascending: false }]);
    expect(f.storage.createSignedUrls).toHaveBeenCalledWith(['user-1/a1/original.jpg', 'user-1/a1/overlay.jpg'], 600);
    expect(a.imageDataUrl).toContain('user-1/a1/original.jpg?token=');
    expect(a.overlayDataUrl).toContain('user-1/a1/overlay.jpg?token=');
    expect(a).toMatchObject({ id: 'a1', state: 'moderada', severity: 'Moderada', latitude: -24.49, longitude: -47.84, classProbabilities: probs });
    expect(a.topClass).toEqual({ code: 'CBB', label: 'CBB', probability: 0.6 });
  });

  it('get devolve null quando não existe (ou é de outra pessoa: a RLS esconde)', async () => {
    const f = fakeSupabase({ respond: () => ({ data: null, error: null }) });
    expect(await new CloudAnalysisRepository(f.client, jpeg).get('x')).toBeNull();
  });

  it('remove apaga os dois arquivos e a linha; clear apaga só as do usuário logado', async () => {
    const f = fakeSupabase({
      respond: (c: QueryCall) => (op(c, 'select') ? { data: [{ image_path: 'user-1/a1/original.jpg', overlay_path: 'user-1/a1/overlay.jpg' }], error: null } : { error: null }),
    });
    const repo = new CloudAnalysisRepository(f.client, jpeg);
    await repo.remove('a1');
    expect(f.storage.remove).toHaveBeenCalledWith(['user-1/a1/original.jpg', 'user-1/a1/overlay.jpg']);
    expect(op(f.calls[0], 'eq')!.args).toEqual(['id', 'a1']);

    await repo.clear();
    const [select, del] = f.calls.slice(1);
    expect(op(select, 'eq')!.args).toEqual(['user_id', 'user-1']);
    expect(op(del, 'delete')).toBeTruthy();
    expect(op(del, 'eq')!.args).toEqual(['user_id', 'user-1']);
  });
});
