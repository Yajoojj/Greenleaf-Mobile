// GreenLeaf — exclusão de conta (LGPD, art. 18, VI).
// A chave service role existe só aqui, no servidor do Supabase; o app nunca a recebe.
// Fluxo: valida o JWT do chamador → apaga os arquivos de {user_id}/ no bucket `leaves` →
// auth.admin.deleteUser. Perfil, análises e localizações saem pelo ON DELETE CASCADE.
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';

const BUCKET = 'leaves';

/** Origens liberadas (variável ALLOWED_ORIGINS, separada por vírgula). Sem ela, qualquer origem: a função exige JWT. */
function corsHeaders(req: Request): Record<string, string> {
  const allowed = (Deno.env.get('ALLOWED_ORIGINS') ?? '').split(',').map((o) => o.trim()).filter(Boolean);
  const origin = req.headers.get('Origin') ?? '';
  return {
    'Access-Control-Allow-Origin': allowed.length === 0 ? '*' : allowed.includes(origin) ? origin : allowed[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

function json(body: unknown, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json' } });
}

/** Lista todos os arquivos sob `prefix` (pastas {user_id}/{analysis_id}/...). */
async function listFiles(admin: SupabaseClient, prefix: string, depth = 0): Promise<string[]> {
  const { data, error } = await admin.storage.from(BUCKET).list(prefix, { limit: 1000 });
  if (error) throw error;
  const out: string[] = [];
  for (const entry of data ?? []) {
    const path = `${prefix}/${entry.name}`;
    // Pastas vêm sem id; arquivos têm id.
    if (entry.id === null && depth < 3) out.push(...(await listFiles(admin, path, depth + 1)));
    else if (entry.id !== null) out.push(path);
  }
  return out;
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, cors);

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'unauthorized' }, 401, cors);

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: { user }, error: userError } = await admin.auth.getUser(token);
  if (userError || !user) return json({ error: 'unauthorized' }, 401, cors);

  try {
    const files = await listFiles(admin, user.id);
    for (let i = 0; i < files.length; i += 100) {
      const { error } = await admin.storage.from(BUCKET).remove(files.slice(i, i + 100));
      if (error) throw error;
    }
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) throw error;
    // Sem e-mail nem id no log: só o resultado.
    console.log(JSON.stringify({ event: 'account_deleted', files: files.length }));
    return json({ deleted: true }, 200, cors);
  } catch (err) {
    console.error(JSON.stringify({ event: 'account_delete_failed', message: err instanceof Error ? err.message : 'unknown' }));
    return json({ error: 'delete_failed' }, 500, cors);
  }
});
