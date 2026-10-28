import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AnalysisRepository } from '../domain/services';
import type { Analysis, User } from '../domain/types';
import { analysis } from '../test/utils';
import { CloudRejectedError } from './CloudAnalysisRepository';
import { LocalAnalysisRepository } from './LocalAnalysisRepository';
import { SessionAwareAnalysisRepository } from './SessionAwareAnalysisRepository';

/** "Nuvem" em memória, que pode estar fora do ar. */
class FakeCloud implements AnalysisRepository {
  rows = new Map<string, Analysis>();
  down = false;
  saves = 0;
  async save(a: Analysis) {
    this.saves += 1;
    if (this.down) throw new Error('Failed to fetch');
    if (a.source === 'demo' || a.simulated) throw new CloudRejectedError('demo');
    if (!this.rows.has(a.id)) this.rows.set(a.id, a); // idempotente pelo id
    return a;
  }
  async list() {
    if (this.down) throw new Error('Failed to fetch');
    return [...this.rows.values()];
  }
  async get(id: string) {
    return this.rows.get(id) ?? null;
  }
  async remove(id: string) {
    this.rows.delete(id);
  }
  async clear() {
    this.rows.clear();
  }
}

const ana: User = { id: 'u-ana', name: 'Ana', email: 'ana@x.co', createdAt: '' };
const bia: User = { id: 'u-bia', name: 'Bia', email: 'bia@x.co', createdAt: '' };

function setup() {
  const idb = new IDBFactory();
  const local = new LocalAnalysisRepository(idb, 'local');
  const cloud = new FakeCloud();
  let user: User | null = null;
  let online = true;
  let reconnect: () => void = () => undefined;
  const repo = new SessionAwareAnalysisRepository({
    local,
    cloud,
    outboxFor: (id) => new LocalAnalysisRepository(idb, `outbox-${id}`),
    auth: { currentUser: async () => user },
    isOnline: () => online,
    onReconnect: (flush) => {
      reconnect = flush;
    },
  });
  return {
    repo,
    local,
    cloud,
    login: (u: User | null) => (user = u),
    setOnline: (v: boolean) => {
      online = v;
      cloud.down = !v;
    },
    reconnect: () => reconnect(),
  };
}

describe('SessionAwareAnalysisRepository', () => {
  let s: ReturnType<typeof setup>;
  beforeEach(() => {
    s = setup();
  });

  it('sem login: tudo fica no aparelho, como antes', async () => {
    await s.repo.save(analysis({ id: 'a1' }));
    expect(await s.local.get('a1')).not.toBeNull();
    expect(s.cloud.saves).toBe(0);
    expect((await s.repo.list()).map((a) => a.id)).toEqual(['a1']);
    await s.repo.remove('a1');
    expect(await s.local.get('a1')).toBeNull();
  });

  it('com login: salva na nuvem e lista da nuvem', async () => {
    s.login(ana);
    await s.repo.save(analysis({ id: 'a1' }));
    expect(s.cloud.rows.has('a1')).toBe(true);
    expect(await s.local.get('a1')).toBeNull();
    expect((await s.repo.list()).map((a) => a.id)).toEqual(['a1']);
  });

  it('demonstração e resultado simulado ficam sempre só no aparelho, mesmo logado', async () => {
    s.login(ana);
    await s.repo.save(analysis({ id: 'd1', source: 'demo' }));
    await s.repo.save(analysis({ id: 's1', simulated: true }));
    expect(s.cloud.saves).toBe(0);
    expect((await s.repo.list()).map((a) => a.id).sort()).toEqual(['d1', 's1']);
  });

  it('sem internet: vai para a fila, aparece no histórico e sobe ao reconectar, sem duplicar', async () => {
    s.login(ana);
    s.setOnline(false);
    await s.repo.save(analysis({ id: 'q1', createdAt: '2026-10-20T10:00:00.000Z' }));
    await s.repo.save(analysis({ id: 'q2', createdAt: '2026-10-20T11:00:00.000Z' }));
    expect(s.cloud.rows.size).toBe(0);
    expect((await s.repo.list()).map((a) => a.id)).toEqual(['q2', 'q1']);

    s.setOnline(true);
    s.reconnect();
    await s.repo.flush();
    expect([...s.cloud.rows.keys()].sort()).toEqual(['q1', 'q2']);
    // fila vazia: listar de novo não reenvia
    const before = s.cloud.saves;
    expect((await s.repo.list()).map((a) => a.id)).toEqual(expect.arrayContaining(['q1', 'q2']));
    expect(s.cloud.saves).toBe(before);
  });

  it('rede cai no meio do envio: também entra na fila', async () => {
    s.login(ana);
    s.cloud.down = true; // navigator.onLine diz "online", mas a requisição falha
    await s.repo.save(analysis({ id: 'x1' }));
    expect(await s.repo.get('x1')).not.toBeNull();
    s.cloud.down = false;
    await s.repo.flush();
    expect(s.cloud.rows.has('x1')).toBe(true);
  });

  it('a fila é de cada conta: o que Ana salvou offline nunca sobe na conta de Bia', async () => {
    s.login(ana);
    s.setOnline(false);
    await s.repo.save(analysis({ id: 'ana-1' }));
    s.login(bia);
    s.setOnline(true);
    await s.repo.flush();
    expect(s.cloud.rows.has('ana-1')).toBe(false);
    s.login(ana);
    await s.repo.flush();
    expect(s.cloud.rows.has('ana-1')).toBe(true);
  });

  it('recusa definitiva do banco não some: volta para o aparelho', async () => {
    s.login(ana);
    const save = vi.spyOn(s.cloud, 'save').mockRejectedValueOnce(new Error('offline')).mockRejectedValueOnce(new CloudRejectedError('23514'));
    await s.repo.save(analysis({ id: 'r1' }));
    await s.repo.flush();
    expect(save).toHaveBeenCalledTimes(2);
    expect(await s.local.get('r1')).not.toBeNull();
  });

  it('primeiro login: conta e envia o histórico local (sem demonstrações) e o tira do aparelho', async () => {
    await s.repo.save(analysis({ id: 'l1' }));
    await s.repo.save(analysis({ id: 'l2', source: 'gallery' }));
    await s.repo.save(analysis({ id: 'demo', source: 'demo' }));
    expect(await s.repo.pendingLocal()).toBe(0); // sem login, nada a enviar
    s.login(ana);
    expect(await s.repo.pendingLocal()).toBe(2);
    expect(await s.repo.uploadLocal()).toBe(2);
    expect([...s.cloud.rows.keys()].sort()).toEqual(['l1', 'l2']);
    expect((await s.local.list()).map((a) => a.id)).toEqual(['demo']);
    expect(await s.repo.pendingLocal()).toBe(0);
  });

  it('remove: fila, demonstração local ou nuvem, conforme onde a análise está', async () => {
    s.login(ana);
    await s.repo.save(analysis({ id: 'c1' }));
    await s.repo.save(analysis({ id: 'd1', source: 'demo' }));
    s.setOnline(false);
    await s.repo.save(analysis({ id: 'q1' }));
    for (const id of ['c1', 'd1', 'q1']) await s.repo.remove(id);
    expect(s.cloud.rows.size).toBe(0);
    expect(await s.local.list()).toEqual([]);
    expect(await s.repo.get('q1')).toBeNull();
  });

  it('clear apaga o que está no aparelho (histórico local e fila), não o histórico da conta', async () => {
    s.login(ana);
    await s.repo.save(analysis({ id: 'c1' }));
    await s.repo.save(analysis({ id: 'd1', source: 'demo' }));
    s.setOnline(false);
    await s.repo.save(analysis({ id: 'q1' }));
    await s.repo.clear();
    expect(await s.local.list()).toEqual([]);
    expect(s.cloud.rows.has('c1')).toBe(true);
    s.setOnline(true);
    await s.repo.flush();
    expect(s.cloud.rows.has('q1')).toBe(false);
  });
});
