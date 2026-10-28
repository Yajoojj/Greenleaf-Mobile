// GreenLeaf — teste ponta a ponta da segurança no Supabase real, pela API pública (chave anônima).
// Dois usuários de teste (A e B) já confirmados; o script os apaga no fim pela edge function delete-account.
//
// Uso:
//   SUPABASE_URL=... SUPABASE_ANON_KEY=... E2E_PASSWORD=... \
//   E2E_EMAIL_A=a@greenleaf.test E2E_EMAIL_B=b@greenleaf.test node scripts/supabase-e2e.mjs
//
// Crie os usuários antes (SQL Editor) — ver docs/seguranca-owasp.md, seção "Como testar a RLS".
import { createClient } from '@supabase/supabase-js';

const { SUPABASE_URL, SUPABASE_ANON_KEY, E2E_PASSWORD, E2E_EMAIL_A, E2E_EMAIL_B } = process.env;
if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !E2E_PASSWORD || !E2E_EMAIL_A || !E2E_EMAIL_B) {
  console.error('Defina SUPABASE_URL, SUPABASE_ANON_KEY, E2E_PASSWORD, E2E_EMAIL_A e E2E_EMAIL_B.');
  process.exit(2);
}

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok });
  console.log(`${ok ? 'ok  ' : 'FALHOU'} ${name}${detail ? ` — ${detail}` : ''}`);
}

async function signIn(email) {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, opts);
  const { data, error } = await client.auth.signInWithPassword({ email, password: E2E_PASSWORD });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  return { client, user: data.user };
}

// JPEG mínimo válido (1×1) — o conteúdo não importa para a RLS.
const JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
  'base64',
);

const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, opts);
const A = await signIn(E2E_EMAIL_A);
const B = await signIn(E2E_EMAIL_B);
const analysisId = crypto.randomUUID();
const base = `${A.user.id}/${analysisId}`;

// A envia imagem, análise e localização
for (const f of ['original.jpg', 'overlay.jpg']) {
  const { error } = await A.client.storage.from('leaves').upload(`${base}/${f}`, JPEG, { contentType: 'image/jpeg' });
  check(`A envia ${f}`, !error, error?.message);
}
const row = {
  id: analysisId, user_id: A.user.id, state: 'leve', probability: 0.4, model_probability: 0.4, hsv_probability: 0.1,
  ratio: 0.02, severity: 'Leve', other_disease: null, class_probabilities: { CBB: 0.4, CBSD: 0.1, CGM: 0.1, CMD: 0.2, Healthy: 0.2 },
  model_version: 'greenleaf_effb0-2026-10-28', processing_time_ms: 100, source: 'camera',
  image_path: `${base}/original.jpg`, overlay_path: `${base}/overlay.jpg`,
};
let r = await A.client.from('analyses').insert(row);
check('A insere a própria análise', !r.error, r.error?.message);
r = await A.client.from('analyses').upsert(row, { onConflict: 'id', ignoreDuplicates: true });
check('reenvio com o mesmo id é idempotente', !r.error, r.error?.message);
r = await A.client.from('locations').insert({ analysis_id: analysisId, latitude: -24.49, longitude: -47.84, consent: true });
check('A insere localização', !r.error, r.error?.message);
r = await A.client.from('analyses').insert({ ...row, id: crypto.randomUUID(), source: 'demo' });
check('análise de demonstração é recusada', Boolean(r.error));

// B tenta acessar A
r = await B.client.from('analyses').select('id').eq('id', analysisId);
check('B não lê análise de A', !r.error && r.data.length === 0);
r = await B.client.from('analyses').delete().eq('id', analysisId).select('id');
check('B não apaga análise de A', !r.error && r.data.length === 0);
r = await B.client.storage.from('leaves').download(`${base}/original.jpg`);
check('B não baixa imagem de A', Boolean(r.error));
r = await B.client.storage.from('leaves').createSignedUrl(`${base}/original.jpg`, 60);
check('B não gera URL assinada da imagem de A', Boolean(r.error));
r = await B.client.storage.from('leaves').remove([`${base}/original.jpg`]);
check('B não apaga imagem de A', !r.error && r.data.length === 0);
r = await B.client.storage.from('leaves').upload(`${A.user.id}/x/original.jpg`, JPEG, { contentType: 'image/jpeg' });
check('B não envia para a pasta de A', Boolean(r.error));

// A ainda vê tudo; URL assinada funciona
r = await A.client.storage.from('leaves').createSignedUrl(`${base}/original.jpg`, 60);
check('A gera URL assinada da própria imagem', !r.error && /token=/.test(r.data?.signedUrl ?? ''));
r = await A.client.from('analyses').select('id, locations(latitude)').eq('id', analysisId);
check('A lê a própria análise com localização', !r.error && r.data.length === 1 && r.data[0].locations?.latitude === -24.49);

// anon
r = await anon.from('analyses').select('id');
check('anon não lê analyses', Boolean(r.error) || r.data.length === 0);
r = await anon.from('feedback').select('id');
check('anon não lê feedback', Boolean(r.error) || r.data.length === 0);
r = await anon.from('feedback').insert({ topic: 'duvida', message: 'teste e2e', app_version: 'e2e' });
check('anon envia feedback', !r.error, r.error?.message);
r = await anon.rpc('heatmap_cells');
check('heatmap não mostra célula com < 5 análises', !r.error && r.data.length === 0, r.error?.message);

// Exportação (LGPD)
r = await A.client.functions.invoke('export-data');
check('export-data devolve só os dados de A', !r.error && r.data?.analyses?.length === 1 && r.data.analyses[0].id === analysisId && r.data.locations.length === 1, r.error?.message);
r = await anon.functions.invoke('export-data');
check('export-data recusa quem não está logado', Boolean(r.error));

// Exclusão de conta: apaga A e B (e com eles os dados de teste)
for (const [name, u] of [['A', A], ['B', B]]) {
  r = await u.client.functions.invoke('delete-account', { method: 'POST' });
  check(`delete-account apaga ${name}`, !r.error && r.data?.deleted === true, r.error?.message);
}
const again = await createClient(SUPABASE_URL, SUPABASE_ANON_KEY, opts).auth.signInWithPassword({ email: E2E_EMAIL_A, password: E2E_PASSWORD });
check('conta apagada não entra mais', Boolean(again.error));

const failed = results.filter((x) => !x.ok).length;
console.log(`\n${results.length - failed}/${results.length} verificações passaram.`);
process.exit(failed ? 1 : 0);
