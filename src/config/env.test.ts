import { describe, expect, it } from 'vitest';
import { checkApiUrl, checkSupabase } from './env';

describe('checkApiUrl', () => {
  it('sem variável → usa mock', () => {
    expect(checkApiUrl(undefined, false)).toEqual({ url: null, error: null });
    expect(checkApiUrl('  ', false)).toEqual({ url: null, error: null });
  });

  it('aceita https e remove barra final', () => {
    expect(checkApiUrl('https://ia.onrender.com/', false).url).toBe('https://ia.onrender.com');
    expect(checkApiUrl('https://ia.example.com/api/', false).url).toBe('https://ia.example.com/api');
  });

  it('recusa http fora de desenvolvimento', () => {
    expect(checkApiUrl('http://ia.onrender.com', false)).toEqual({ url: null, error: 'insecure' });
    expect(checkApiUrl('http://localhost:8000', false)).toEqual({ url: null, error: 'insecure' });
  });

  it('aceita http só em desenvolvimento e só para a própria máquina', () => {
    expect(checkApiUrl('http://localhost:8000', true).url).toBe('http://localhost:8000');
    expect(checkApiUrl('http://127.0.0.1:8000', true).url).toBe('http://127.0.0.1:8000');
    expect(checkApiUrl('http://192.168.0.10:8000', true).error).toBe('insecure');
  });

  it('recusa esquemas e URLs estranhas', () => {
    expect(checkApiUrl('javascript:alert(1)', true).error).toBe('invalid');
    expect(checkApiUrl('ftp://x.com', true).error).toBe('invalid');
    expect(checkApiUrl('https://user:pass@x.com', true).error).toBe('invalid');
    expect(checkApiUrl('https://x.com/?token=1', true).error).toBe('invalid');
    expect(checkApiUrl('não é url', true).error).toBe('invalid');
  });
});

describe('checkSupabase', () => {
  const jwt = (role: string) => `x.${btoa(JSON.stringify({ role })).replace(/=+$/, '')}.y`;

  it('sem variáveis → mocks, sem erro', () => {
    expect(checkSupabase(undefined, undefined, false)).toEqual({ config: null, error: null });
  });

  it('aceita URL https + chave anônima ou publicável', () => {
    expect(checkSupabase('https://abc.supabase.co/', jwt('anon'), false).config).toEqual({ url: 'https://abc.supabase.co', anonKey: jwt('anon') });
    expect(checkSupabase('https://abc.supabase.co', 'sb_publishable_123', false).config?.anonKey).toBe('sb_publishable_123');
  });

  it('recusa a chave service role e chaves secretas', () => {
    expect(checkSupabase('https://abc.supabase.co', jwt('service_role'), false)).toEqual({ config: null, error: 'secret_key' });
    expect(checkSupabase('https://abc.supabase.co', 'sb_secret_abc', false).error).toBe('secret_key');
  });

  it('exige as duas variáveis e https', () => {
    expect(checkSupabase('https://abc.supabase.co', '', false).error).toBe('invalid');
    expect(checkSupabase(undefined, jwt('anon'), false).error).toBe('invalid');
    expect(checkSupabase('http://abc.supabase.co', jwt('anon'), false).error).toBe('insecure');
  });
});
