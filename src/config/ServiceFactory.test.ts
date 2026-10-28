import { afterEach, describe, expect, it } from 'vitest';
import { ServiceFactory } from './ServiceFactory';

const reset = () => {
  (ServiceFactory as unknown as { shared?: unknown }).shared = undefined;
};

describe('ServiceFactory', () => {
  afterEach(reset);

  it('sem VITE_SUPABASE_*: mocks locais, exatamente como antes', () => {
    reset();
    const s = ServiceFactory.create({ demoMode: false, apiUrl: null, supabase: null });
    expect(s.accountMode).toBe('local');
    expect(s.historySync).toBeUndefined();
    expect(s.heatmap.simulated).toBe(true);
    expect(s.predictionMode).toBe('mock');
  });

  it('com URL e chave anônima: Supabase (histórico composto, mapa real)', () => {
    reset();
    const s = ServiceFactory.create({ demoMode: false, apiUrl: 'https://ia.example.com', supabase: { url: 'https://abc.supabase.co', anonKey: 'sb_publishable_test' } });
    expect(s.accountMode).toBe('cloud');
    expect(s.historySync).toBe(s.analyses);
    expect(s.heatmap.simulated).toBe(false);
    expect(s.predictionMode).toBe('api');
  });

  it('modo demonstração continua usando as respostas gravadas', () => {
    reset();
    const s = ServiceFactory.create({ demoMode: true, apiUrl: 'https://ia.example.com', supabase: null });
    expect(s.predictionMode).toBe('demo');
  });
});
