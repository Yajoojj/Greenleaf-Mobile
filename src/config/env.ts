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

export type SupabaseConfig = { url: string; anonKey: string };
export type SupabaseCheck = { config: SupabaseConfig | null; error: 'insecure' | 'invalid' | 'secret_key' | null };

/** Lê o `role` de uma chave JWT legada sem validar a assinatura (só para recusar a service role). */
function jwtRole(key: string): string | null {
  const payload = key.split('.')[1];
  if (!payload) return null;
  try {
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return typeof json?.role === 'string' ? json.role : null;
  } catch {
    return null;
  }
}

/**
 * Back-end do app (Supabase). Precisa das duas variáveis; sem elas o app segue com os mocks.
 * Recusa chave secreta/service role: ela daria acesso total ao banco a qualquer visitante.
 */
export function checkSupabase(rawUrl: string | undefined, rawKey: string | undefined, isDev: boolean): SupabaseCheck {
  const key = rawKey?.trim() ?? '';
  const url = checkApiUrl(rawUrl, isDev);
  if (!url.url && !url.error && !key) return { config: null, error: null };
  if (url.error) return { config: null, error: url.error };
  if (!url.url || !key) return { config: null, error: 'invalid' };
  if (key.startsWith('sb_secret_') || jwtRole(key) === 'service_role') return { config: null, error: 'secret_key' };
  return { config: { url: url.url, anonKey: key }, error: null };
}

function flag(value: string | undefined): boolean {
  return value === 'true' || value === '1';
}

const api = checkApiUrl(import.meta.env.VITE_API_URL, import.meta.env.DEV);

if (api.error) {
  // Sem detalhes da URL no log; apenas o motivo.
  console.warn(`[GreenLeaf] VITE_API_URL ignorada (${api.error}). Usando o serviço simulado.`);
}

const supabase = checkSupabase(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY, import.meta.env.DEV);

if (supabase.error) {
  console.warn(`[GreenLeaf] VITE_SUPABASE_* ignoradas (${supabase.error}). Usando contas e histórico locais.`);
}

export const env = {
  apiUrl: api.url,
  supabase: supabase.config,
  apiUrlError: api.error,
  isDev: import.meta.env.DEV,
  version: __APP_VERSION__,
} as const;

/** Feature flags — telas futuras ficam escondidas até a flag ser ligada no build. */
export const flags = {
  FEATURE_GEOLOCATION: flag(import.meta.env.VITE_FEATURE_GEOLOCATION),
  FEATURE_HEATMAP: flag(import.meta.env.VITE_FEATURE_HEATMAP),
} as const;
