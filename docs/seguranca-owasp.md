# Checklist de segurança do front-end (SDA)

Base: **OWASP Top 10 (2021)** e **OWASP ASVS 4.0** (itens aplicáveis a um SPA/PWA sem back-end próprio).
Legenda: ✅ aplicado · ⏳ depende do back-end/hospedagem · — não se aplica a este ciclo.

## Segredos e configuração

| Item | Status | Onde |
|---|---|---|
| Nenhum segredo no código; só `VITE_API_URL` e flags | ✅ | `.env.example`, `src/config/env.ts` |
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
| Content Security Policy sem `unsafe-inline`/`unsafe-eval`; `connect-src` só para a origem da API | ✅ | plugin `greenleaf-csp` em `vite.config.ts` |
| `frame-ancestors 'none'`, HSTS, `nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy` | ✅ arquivos prontos / ⏳ hospedagem aplicar | `public/_headers`, `vercel.json` |
| Fontes locais (sem CDN de terceiros) | ✅ | `@fontsource/montserrat` |
| `<meta name="referrer" content="no-referrer">` | ✅ | `index.html` |

## A06 Componentes vulneráveis

| Item | Status | Onde |
|---|---|---|
| Dependências mínimas e versões fixas | ✅ | `package.json` (sem `^`) |
| `npm audit --omit=dev` sem achados | ✅ (27/10/2026) | CI: `.github/workflows/ci.yml` |
| Ferramentas de desenvolvimento com alertas (Vitest 2/Vite 5) | ⏳ atualizar | `docs/decisoes.md` D-18 |

## A07 Autenticação (mock)

| Item | Status | Onde |
|---|---|---|
| Senha nunca guardada em texto (PBKDF2-SHA-256, 100 mil iterações, sal aleatório) | ✅ (testado) | `MockAuthService.ts` |
| Mensagem única para e-mail inexistente e senha errada | ✅ (testado) | `MockAuthService.ts` |
| Senha mínima de 8 caracteres; `autocomplete` correto | ✅ | `AuthPage.tsx` |
| Autenticação real, sessão, limitação de tentativas | ⏳ Supabase Auth | prompt de back-end |

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
| Histórico só no aparelho e só quando o usuário salva | ✅ | `ResultPage.tsx`, `LocalAnalysisRepository` |
| "Apagar dados deste aparelho" (histórico, preferências, contas de teste, consentimento) | ✅ | `ProfilePage.tsx` |
| Localização só com consentimento explícito, revogável, arredondada (~1 km), atrás de flag | ✅ | `BrowserLocationService`, `LocationConsentPage` |
| Texto de privacidade em linguagem simples | ✅ | Perfil → Privacidade |
| Sem rastreadores/analytics de terceiros | ✅ | — |

## A01 Controle de acesso / A08 Integridade / A10 SSRF

| Item | Status | Onde |
|---|---|---|
| Controle de acesso aos dados na nuvem (RLS no Supabase) | ⏳ | back-end |
| Service worker só faz cache de arquivos do próprio app (não guarda respostas da API) | ✅ | `vite.config.ts` (workbox `globPatterns`) |
| SSRF | — | não há servidor no front |

## Como verificar

```bash
npm test
```

```bash
npm audit --omit=dev
```
