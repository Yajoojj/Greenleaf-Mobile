// GreenLeaf — exportação dos dados do usuário (LGPD, art. 18, II e V: acesso e portabilidade).
// Usa o JWT do próprio usuário e a chave anônima: a RLS garante que só os dados dele saem.
// Não precisa da chave service role.
import { createClient } from 'jsr:@supabase/supabase-js@2';

function corsHeaders(req: Request): Record<string, string> {
  const allowed = (Deno.env.get('ALLOWED_ORIGINS') ?? '').split(',').map((o) => o.trim()).filter(Boolean);
  const origin = req.headers.get('Origin') ?? '';
  return {
    'Access-Control-Allow-Origin': allowed.length === 0 ? '*' : allowed.includes(origin) ? origin : allowed[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    Vary: 'Origin',
  };
}

function json(body: unknown, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST' && req.method !== 'GET') return json({ error: 'method_not_allowed' }, 405, cors);

  const authorization = req.headers.get('Authorization') ?? '';
  const token = authorization.replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'unauthorized' }, 401, cors);

  const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: { user }, error: userError } = await client.auth.getUser(token);
  if (userError || !user) return json({ error: 'unauthorized' }, 401, cors);

  const [profile, analyses, locations] = await Promise.all([
    client.from('profiles').select('id, name, created_at').eq('id', user.id).maybeSingle(),
    client.from('analyses').select('*').order('created_at', { ascending: false }),
    client.from('locations').select('analysis_id, latitude, longitude, consent, created_at'),
  ]);
  const failed = [profile.error, analyses.error, locations.error].find(Boolean);
  if (failed) {
    console.error(JSON.stringify({ event: 'export_failed', message: failed.message }));
    return json({ error: 'export_failed' }, 500, cors);
  }

  console.log(JSON.stringify({ event: 'data_exported', analyses: analyses.data?.length ?? 0 }));
  return json(
    {
      exported_at: new Date().toISOString(),
      account: { id: user.id, email: user.email, created_at: user.created_at },
      profile: profile.data,
      analyses: analyses.data,
      locations: locations.data,
      // As fotos ficam no bucket privado `leaves`, nos caminhos image_path/overlay_path de cada análise.
    },
    200,
    cors,
  );
});
