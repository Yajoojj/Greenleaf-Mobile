# Checklist de segurança do front-end (SDA)

Base: **OWASP Top 10 (2021)** e **OWASP ASVS 4.0** (itens aplicáveis a um SPA/PWA sem back-end próprio).
Legenda: ✅ aplicado · ⏳ depende do back-end/hospedagem · — não se aplica a este ciclo.

## Segredos e configuração

| Item | Status | Onde |
|---|---|---|
| Nenhum segredo no código; só `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (pública) e flags | ✅ | `.env.example`, `src/config/env.ts` |
| Chave service role/`sb_secret_` **recusada** pelo app se for colocada por engano | ✅ (testado) | `checkSupabase` em `src/config/env.ts`, `env.test.ts` |
| Service role ausente do bundle: busca no `dist/` só acha o texto da própria verificação; o único JWT tem `role: anon` | ✅ (28/10/2026) | `npm run build` + busca em `dist/` |
| `.env` e `.env.local` fora do Git | ✅ | `.gitignore` |
| `VITE_API_URL` só com HTTPS; `http://` aceito apenas em desenvolvimento e para a própria máquina; URL com usuário/senha/query recusada | ✅ (testado) | `checkApiUrl` em `src/config/env.ts`, `env.test.ts` |
| Sem source maps no build de produção | ✅ | `vite.config.ts` (`build.sourcemap: false`) |

## A03 Injeção / XSS

| Item | Status | Onde |
|---|---|---|
| Nenhum HTML vindo da API é renderizado (sem `dangerouslySetInnerHTML`/`innerHTML`) | ✅ (testado) | `src/test/architecture.test.ts` |
| Resposta da API validada por schema (zod) antes de chegar à tela; resposta fora do contrato vira erro amigável | ✅ (testado) | `src/domain/schemas.ts`, `HttpPredictionService` |
| Overlay aceito **só** como `data:image/png|jpeg;base64` — sem URL externa, SVG ou HTML | ✅ (testado) | `schemas.ts`, `schemas.test.ts` |
| `/health` validado por schema | ✅ | `healthStatusSchema` |
| Textos do usuário (suporte) limitados em tamanho e nunca interpretados como HTML | ✅ | `SupportPage.tsx`, `MockFeedbackService.ts` |

## A05 Configuração / cabeçalhos

| Item | Status | Onde |
|---|---|---|
| Content Security Policy sem `unsafe-inline`/`unsafe-eval`; `connect-src` só para a IA (Render) e o Supabase do app; `img-src` só para o Supabase (URLs assinadas) | ✅ | plugin `greenleaf-csp` em `vite.config.ts`, `vercel.json`, `public/_headers` |
| `frame-ancestors 'none'`, HSTS, `nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy` | ✅ arquivos prontos / ⏳ hospedagem aplicar | `public/_headers`, `vercel.json` |
| Fontes locais (sem CDN de terceiros) | ✅ | `@fontsource/montserrat` |
| `<meta name="referrer" content="no-referrer">` | ✅ | `index.html` |

## A06 Componentes vulneráveis

| Item | Status | Onde |
|---|---|---|
| Dependências mínimas e versões fixas | ✅ | `package.json` (sem `^`) |
| `npm audit --omit=dev` sem achados (inclui `@supabase/supabase-js` 2.117.3) | ✅ (28/10/2026) | CI: `.github/workflows/ci.yml` |
| Ferramentas de desenvolvimento com alertas (Vitest 2/Vite 5) | ⏳ atualizar | `docs/decisoes.md` D-18 |

## A07 Autenticação

| Item | Status | Onde |
|---|---|---|
| Senha nunca guardada em texto (PBKDF2-SHA-256, 100 mil iterações, sal aleatório) | ✅ (testado) | `MockAuthService.ts` |
| Mensagem única para e-mail inexistente e senha errada | ✅ (testado) | `MockAuthService.ts` |
| Senha mínima de 8 caracteres; `autocomplete` correto | ✅ | `AuthPage.tsx` |
| Autenticação real (Supabase Auth: e-mail e senha, confirmação de e-mail, rate limit padrão) | ✅ | `SupabaseAuthService.ts` |
| Mesma mensagem para e-mail inexistente e senha errada também no Supabase | ✅ (testado) | `SupabaseAuthService.test.ts` |
| Senha mínima 8 também no servidor; SMTP próprio; Site URL/Redirect URLs | ⏳ painel do Supabase | `docs/decisoes.md` D-25 |

## Upload de imagem

| Item | Status | Onde |
|---|---|---|
| Valida tipo (JPEG/PNG) e tamanho (8 MB) antes do envio | ✅ | `BrowserImagePreparer.validate` |
| Recompressão no aparelho **remove EXIF, inclusive GPS** | ✅ | `BrowserImagePreparer.prepare` |
| Rejeita imagens minúsculas/ilegíveis | ✅ | `MIN_SIDE_PX` |
| Servidor também valida tipo/tamanho | ✅ (já existe) | Axios Cassava IA `main.py` |

## A04/A09 Erros e logs

| Item | Status | Onde |
|---|---|---|
| Mensagens amigáveis, sem detalhes internos (corpo `detail`, stack, URL nunca vão para a tela) | ✅ | `PredictionError`, `i18n` `error.*` |
| Nenhum dado pessoal em logs (o único `console.warn` diz apenas o motivo da URL recusada) | ✅ | `src/config/env.ts` |
| Tempo-limite e cancelamento em toda chamada de rede | ✅ (testado) | `HttpPredictionService` |

## Privacidade (LGPD)

| Item | Status | Onde |
|---|---|---|
| Histórico só quando o usuário salva: sem conta, no aparelho; com conta, na nuvem com RLS | ✅ | `ResultPage.tsx`, `SessionAwareAnalysisRepository` |
| Demonstração e resultado simulado nunca vão para a nuvem (app **e** banco: `source` só `camera`/`gallery`) | ✅ (testado) | `SessionAwareAnalysisRepository`, `CloudAnalysisRepository`, `rls.test.sql` |
| Exclusão da conta apaga perfil, análises, localizações e fotos | ✅ (testado ponta a ponta) | edge function `delete-account` |
| Exportação dos dados (JSON) com o JWT do próprio usuário | ✅ API / ⏳ botão na tela | edge function `export-data`, D-24 |
| Localização individual nunca exposta: mapa só com células agregadas de ~5 km e ≥ 5 análises | ✅ (testado) | `heatmap_cells()`, D-23 |
| "Apagar dados deste aparelho" (histórico, preferências, contas de teste, consentimento) | ✅ | `ProfilePage.tsx` |
| Localização só com consentimento explícito, revogável, arredondada (~1 km), atrás de flag | ✅ | `BrowserLocationService`, `LocationConsentPage` |
| Texto de privacidade em linguagem simples | ✅ | Perfil → Privacidade |
| Sem rastreadores/analytics de terceiros | ✅ | — |

## A01 Controle de acesso / A08 Integridade / A10 SSRF

| Item | Status | Onde |
|---|---|---|
| Controle de acesso aos dados na nuvem (RLS no Supabase) | ✅ (testado) | seção "Back-end (Supabase)" abaixo |
| Service worker só faz cache de arquivos do próprio app (não guarda respostas da API) | ✅ | `vite.config.ts` (workbox `globPatterns`) |
| SSRF | — | não há servidor no front |

## Back-end (Supabase) — o que foi aplicado e onde

Projeto `greenleaf-app` (`mfngcmjgisfgttsgqyfl`, São Paulo), só do app. Os logs técnicos da IA (`prediction_logs`) ficam em
outro projeto, gravados pelo servidor da IA; o app não tem acesso a eles.

| Item | Status | Onde |
|---|---|---|
| RLS ativa em **todas** as tabelas, com políticas explícitas e comentadas | ✅ | `supabase/migrations/*_rls.sql` |
| `profiles`: só o dono lê e atualiza (só a coluna `name`); criado por trigger no cadastro | ✅ | `*_schema.sql`, `*_rls.sql` |
| `analyses`: dono faz `select`/`insert`/`delete`; **sem `update`** (histórico imutável) | ✅ (testado) | `*_rls.sql` |
| `locations`: só via análise do próprio usuário | ✅ (testado) | `*_rls.sql` |
| `feedback`: `insert` para `anon` (sem `user_id`) e `authenticated` (só o próprio id); **ninguém lê pelo cliente** | ✅ (testado) | `*_rls.sql` |
| GRANTs mínimos por papel, além da RLS (`anon` não tem `select` em nada além do mapa) | ✅ | `*_rls.sql` |
| Storage: bucket **privado** `leaves`, só JPEG/PNG, 8 MB; políticas pelo prefixo `{auth.uid()}/`; sem `update` | ✅ (testado) | `*_storage.sql` |
| Fotos entregues às telas só por **URLs assinadas de 10 minutos** | ✅ | `CloudAnalysisRepository` |
| Caminho do arquivo amarrado ao dono no banco (`image_path = user_id/id/original.jpg`) | ✅ | `*_schema.sql` |
| Funções com `search_path` fixo; função `SECURITY DEFINER` fora do esquema exposto | ✅ | `*_heatmap_private.sql` |
| Chave service role só dentro da edge function `delete-account` (variável do Supabase) | ✅ | `supabase/functions/delete-account` |
| `export-data` sem service role (JWT do usuário + RLS) | ✅ | `supabase/functions/export-data` |
| Edge functions com `verify_jwt`, só `POST`/`OPTIONS` (e `GET` na exportação), logs sem e-mail nem id | ✅ | `supabase/functions/*` |
| Envio idempotente (id do app + `ON CONFLICT DO NOTHING`), sem `upsert` que sobrescreva | ✅ | `CloudAnalysisRepository` |

### Advisors do Supabase (28/10/2026)

| Advisor | Resultado | Ação |
|---|---|---|
| Segurança, 1ª rodada | 2 avisos: `heatmap_cells()` `SECURITY DEFINER` executável por `anon` e `authenticated` via API (lints 0028/0029) | Função com privilégio movida para o esquema `private`; `public.heatmap_cells()` virou `SECURITY INVOKER` (`*_heatmap_private.sql`) |
| Segurança, 2ª rodada | **nenhum alerta** | — |
| Desempenho | Só INFO "índice ainda não usado" em `analyses_user_created_idx`, `analyses_user_state_idx` e `feedback_user_idx` | Esperado com tabelas vazias; são os índices das consultas do app (`user_id, created_at desc` e `user_id, state`) |

### Como testar a RLS

1. **SQL** (sem deixar rastro): cole `supabase/tests/rls.test.sql` no SQL Editor. Ele cria os usuários A e B dentro de uma
   transação, verifica que A não lê, não apaga e não baixa imagem de B, que `anon` não lê `analyses` nem `feedback`, que o mapa
   não mostra célula com menos de 5 análises nem coordenada individual, que o banco recusa severidade em folha sadia e
   análise de demonstração, e termina com `ROLLBACK`. Resultado em 28/10/2026: **todos passaram**.
2. **Ponta a ponta pela API pública**: crie dois usuários de teste confirmados (no painel, Authentication → Add user, ou por SQL)
   e rode:

```bash
SUPABASE_URL=https://<ref>.supabase.co SUPABASE_ANON_KEY=<chave-anon> E2E_PASSWORD=<senha-de-teste> E2E_EMAIL_A=a@greenleaf.test E2E_EMAIL_B=b@greenleaf.test node scripts/supabase-e2e.mjs
```

   Ele testa upload, URL assinada, download e exclusão cruzados, `anon`, feedback, mapa, `export-data` e, no fim, apaga os dois
   usuários com `delete-account`. Resultado em 28/10/2026: **23/23** e banco vazio depois (usuários, perfis, análises,
   localizações e arquivos).

## Como verificar

```bash
npm test
```

```bash
npm audit --omit=dev
```
