/**
 * Variáveis públicas (VITE_*). Nada aqui é segredo: tudo vai para o navegador.
 */

export type ApiUrlCheck = { url: string | null; error: 'insecure' | 'invalid' | null };

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * Aceita a URL da API somente com HTTPS. `http://` só é aceito em desenvolvimento
 * e apontando para a própria máquina.
 */
export function checkApiUrl(raw: string | undefined, isDev: boolean): ApiUrlCheck {
  const value = raw?.trim();
  if (!value) return { url: null, error: null };
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return { url: null, error: 'invalid' };
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) return { url: null, error: 'invalid' };
  if (parsed.protocol === 'https:') return { url: parsed.origin + parsed.pathname.replace(/\/+$/, ''), error: null };
  if (parsed.protocol === 'http:' && isDev && (LOCAL_HOSTS.has(parsed.hostname) || parsed.hostname.endsWith('.localhost'))) {
    return { url: parsed.origin + parsed.pathname.replace(/\/+$/, ''), error: null };
  }
  return { url: null, error: parsed.protocol === 'http:' ? 'insecure' : 'invalid' };
}

function flag(value: string | undefined): boolean {
  return value === 'true' || value === '1';
}

const api = checkApiUrl(import.meta.env.VITE_API_URL, import.meta.env.DEV);

if (api.error) {
  // Sem detalhes da URL no log; apenas o motivo.
  console.warn(`[GreenLeaf] VITE_API_URL ignorada (${api.error}). Usando o serviço simulado.`);
}

export const env = {
  apiUrl: api.url,
  apiUrlError: api.error,
  isDev: import.meta.env.DEV,
  version: __APP_VERSION__,
} as const;

/** Feature flags — telas futuras ficam escondidas até a flag ser ligada no build. */
export const flags = {
  FEATURE_GEOLOCATION: flag(import.meta.env.VITE_FEATURE_GEOLOCATION),
  FEATURE_HEATMAP: flag(import.meta.env.VITE_FEATURE_HEATMAP),
} as const;
