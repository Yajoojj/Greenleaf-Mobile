import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import type { Analysis } from '../domain/types';
import { LocalAnalysisRepository } from './LocalAnalysisRepository';

function analysis(id: string, state: Analysis['state'], createdAt: string): Analysis {
  return {
    id,
    createdAt,
    state,
    probability: 0.1,
    modelProbability: null,
    hsvProbability: 0.1,
    ratio: 0.02,
    severity: state === 'sadia' ? null : 'Leve',
    processingTimeMs: 10,
    imageDataUrl: 'data:image/jpeg;base64,AA==',
    overlayDataUrl: 'data:image/png;base64,AA==',
  };
}

describe('LocalAnalysisRepository (IndexedDB)', () => {
  it('salva, lista do mais novo para o mais antigo, filtra, busca e apaga', async () => {
    const repo = new LocalAnalysisRepository(new IDBFactory());
    await repo.save(analysis('a', 'sadia', '2026-10-01T10:00:00Z'));
    await repo.save(analysis('b', 'leve', '2026-10-03T10:00:00Z'));
    await repo.save(analysis('c', 'leve', '2026-10-02T10:00:00Z'));

    expect((await repo.list()).map((x) => x.id)).toEqual(['b', 'c', 'a']);
    expect((await repo.list({ state: 'leve' })).map((x) => x.id)).toEqual(['b', 'c']);
    expect(await repo.list({ state: 'grave' })).toEqual([]);
    expect((await repo.get('a'))?.state).toBe('sadia');
    expect(await repo.get('zzz')).toBeNull();

    await repo.remove('b');
    expect((await repo.list()).map((x) => x.id)).toEqual(['c', 'a']);
    await repo.clear();
    expect(await repo.list()).toEqual([]);
  });

  it('save com o mesmo id substitui (não duplica)', async () => {
    const repo = new LocalAnalysisRepository(new IDBFactory());
    await repo.save(analysis('x', 'leve', '2026-10-01T10:00:00Z'));
    await repo.save({ ...analysis('x', 'grave', '2026-10-01T10:00:00Z') });
    const all = await repo.list();
    expect(all).toHaveLength(1);
    expect(all[0].state).toBe('grave');
  });
});
