import { describe, expect, it } from 'vitest';
import { checkApiUrl } from './env';

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
