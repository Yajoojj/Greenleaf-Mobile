import { describe, expect, it } from 'vitest';
import { fakeSupabase, op } from '../test/fakeSupabase';
import { MockHeatmapService } from './MockHeatmapService';
import { SupabaseFeedbackService } from './SupabaseFeedbackService';
import { SupabaseHeatmapService } from './SupabaseHeatmapService';

describe('SupabaseFeedbackService', () => {
  it('grava na tabela feedback com o id do usuário logado e a versão do app', async () => {
    const f = fakeSupabase();
    await new SupabaseFeedbackService(f.client, '0.2.0').send({ topic: 'sugestao', message: '  Mais fotos  ', rating: 4, contactEmail: ' a@b.co ' });
    expect(f.calls[0].table).toBe('feedback');
    expect(op(f.calls[0], 'insert')?.args[0]).toEqual({
      user_id: 'user-1',
      topic: 'sugestao',
      message: 'Mais fotos',
      rating: 4,
      contact_email: 'a@b.co',
      app_version: '0.2.0',
    });
    // Sem .select(): a RLS não deixa ler de volta (nem o próprio autor).
    expect(op(f.calls[0], 'select')).toBeUndefined();
  });

  it('sem conta, user_id vai nulo; mensagem vazia não é enviada; erro do banco vira falha', async () => {
    const f = fakeSupabase({ session: null });
    await new SupabaseFeedbackService(f.client, '1').send({ topic: 'duvida', message: 'oi' });
    expect((op(f.calls[0], 'insert')?.args[0] as { user_id: unknown }).user_id).toBeNull();
    await expect(new SupabaseFeedbackService(f.client, '1').send({ topic: 'duvida', message: '   ' })).rejects.toThrow();
    const failing = fakeSupabase({ respond: () => ({ data: null, error: { code: '42501' } }) });
    await expect(new SupabaseFeedbackService(failing.client, '1').send({ topic: 'duvida', message: 'oi' })).rejects.toThrow();
  });
});

describe('HeatmapService', () => {
  it('Supabase: chama heatmap_cells() e converte numeric em número', async () => {
    const f = fakeSupabase();
    f.rpc.mockResolvedValueOnce({ data: [{ latitude: '-24.503', longitude: '-47.858', total: 7, infected: 3 }], error: null });
    const svc = new SupabaseHeatmapService(f.client);
    expect(svc.simulated).toBe(false);
    expect(await svc.cells()).toEqual([{ latitude: -24.503, longitude: -47.858, total: 7, infected: 3 }]);
    expect(f.rpc).toHaveBeenCalledWith('heatmap_cells');
  });

  it('mock: dados fictícios marcados como simulados', async () => {
    const svc = new MockHeatmapService();
    expect(svc.simulated).toBe(true);
    const cells = await svc.cells();
    expect(cells.length).toBeGreaterThan(0);
    expect(cells.every((c) => c.infected <= c.total)).toBe(true);
  });
});
