# Decisões e suposições — front-end GreenLeaf

Diário de bordo técnico. Cada item diz **o que** foi decidido, **por quê** e se é **suposição** a confirmar com a equipe.

## 27/10/2026 — versão inicial do front-end

### D-01 Stack: Vite + React 18 + TypeScript, PWA com vite-plugin-pwa
Os Artefatos citam Expo para o app; o pedido deste ciclo é um **PWA** (mesmo código no celular instalado e no desktop).
Escolhi Vite (build rápido e simples) em vez de Next.js porque o app é 100% cliente, precisa funcionar offline e
não tem SSR. Dependências de execução mínimas: `react`, `react-dom`, `react-router-dom`, `zod`, `lucide-react`, `@fontsource/montserrat`.

### D-02 Contrato da API conferido no código (e dois achados para o back-end)
Li `backend/main.py`, `config.py` e `hsv_utils.py` do Axios Cassava IA. O contrato do prompt confere. Achados:
1. **Cores do overlay trocadas no servidor.** `main.py` passa um array **RGB** para `cv2.imencode`, que espera **BGR**:
   no PNG devolvido o vermelho vira azul (as lesões aparecem **azuis** e o solo azulado). O app e a legenda seguem o
   comportamento pretendido ("folha verde, lesão vermelha"). Correção sugerida no servidor, uma linha:
   `cv2.imencode(".png", cv2.cvtColor(overlay_image, cv2.COLOR_RGB2BGR))`.
2. **CORS**: o padrão é `http://localhost:3000`. É preciso adicionar a origem do PWA em `CORS_ORIGINS`
   (`http://localhost:5173` em desenvolvimento e o domínio publicado).
3. Folha sadia volta com `severity: "Leve"` (confirmado: `classify_severity` roda sempre). O front ignora a severidade quando `class === "Saudavel"`.

### D-03 Quatro estados na tela, não três
O artigo fala em "sadia, leve, grave", mas a API tem três severidades (`Leve`, `Moderada`, `Grave`) + `Saudavel`.
A tela segue a API: **Sadia, Leve, Moderada, Grave**. Foi criado o laranja para Moderada.

### D-04 Imagens do modo demonstração são ilustrações, não fotos (SUPOSIÇÃO / PENDENTE)
Não havia fotos reais de folhas disponíveis no material recebido, e não baixei imagens de terceiros.
As 4 folhas de `public/demo/` são **desenhadas por código** (`scripts/generate_demo_assets.py`) e a tela de demonstração diz
"Imagens ilustrativas geradas por computador". As respostas gravadas **não foram inventadas**: foram calculadas rodando o
próprio `hsv_utils.py` do servidor sobre essas imagens, no caminho "só cor" (sem o modelo carregado) — por isso
`model_probability` é `null` e aparece o aviso "Análise feita apenas pela cor das manchas".
**Pendente da equipe:** trocar por 4 fotos reais da base de imagens e rodar `scripts/record-demo.mjs` contra a API publicada.

### D-05 Serviço simulado reage à foto enviada
Sem `VITE_API_URL`, o `MockPredictionService` não sorteia resultados: ele roda no navegador uma aproximação do caminho
"só cor" do servidor (mesmos limiares HSV e mesma regra de severidade), devolvendo a resposta no formato real.
Todo resultado assim vem marcado com o selo **"Resultado simulado"**. Não há rede neural no navegador.

### D-06 Modo demonstração reconhece os exemplos pelo conteúdo (SHA-256)
O contrato `predict(file)` não recebe "qual exemplo é". Para não mudar a interface, o `DemoPredictionService` compara
o hash da imagem com o dos 4 exemplos e devolve a resposta gravada; foto desconhecida vai para a análise local.
Funciona offline porque imagens, overlays e o JSON estão no precache do service worker.

### D-07 Extras opcionais nos contratos
- `PredictionService.predict(file, signal?, progress?)`: o 3º parâmetro opcional avisa quando o upload terminou, para a etapa
  "Enviando → Analisando" ser **real**. Por isso o `HttpPredictionService` usa XHR (fetch não informa progresso de envio).
- `AnalysisRepository.clear()` (apagar dados locais — LGPD), `LocationService.revokeConsent()` e `consentStatus()`.
- `FeedbackService` e `ImagePreparer` (novos), para o Suporte e a preparação da foto também ficarem atrás de interfaces.
Os parâmetros extras são opcionais; implementações do back-end podem ignorá-los.

### D-08 Tempo-limite, novas tentativas e servidor dormindo
Render no plano gratuito "dorme" e leva 30–60 s para acordar. Decisões: tempo-limite de **75 s** por tentativa,
**1 nova tentativa** com espera de 1,5 s para `502/503/504`, falha de rede, tempo esgotado e `500`; `400` e `413` não repetem.
A tela mostra "demorando" após 5 s (meta RNF2) e "servidor acordando, até 1 minuto" após 12 s. A tela inicial consulta
`/health` (o que já acorda o servidor) e repete a cada 10 s enquanto ele estiver acordando.

### D-09 Preparação da foto no aparelho
Lado maior limitado a **1280 px**, JPEG qualidade 0,82, rotação do EXIF aplicada. A recompressão pelo canvas descarta
todos os metadados, inclusive **GPS**. Menos de 224 px (entrada da EfficientNet) é recusado como "foto pequena".
Suposição: 1280 px preserva detalhe suficiente para a análise de cor; ajustar se a equipe medir perda de qualidade.

### D-10 Salvar é uma escolha do produtor
O resultado **não** vai para o histórico automaticamente: há o botão "Salvar no histórico" (pedido do prompt e mais respeitoso
com dados). O histórico fica em IndexedDB, com a foto reduzida, e abre sem internet.

### D-11 Cores, contraste e tipografia
- Branco sobre `#57B846` tem contraste 2,6:1 (reprovado). Botões usam **green.700 `#2F7A28`** (5,3:1). O `#57B846` continua
  como cor de marca em bordas, barras e na folha do overlay.
- Texto de estado sempre em tom 800 sobre fundo 50 da mesma cor (todos ≥ 4,5:1). Testado em `src/ui/tokens.test.ts`.
- Montserrat local (`@fontsource`, só subconjunto latino) — funciona offline e dispensa Google Fonts na CSP.
- Escala normalizada: título 29,51 → **30 px**, corpo 18,04 → **18 px**, botão 15 → **18 px** (o prompt pede corpo ≥ 16–18 px e
  15 px ficava pequeno sob sol). Espaçamento 4/8/16/24/32, raio 12, alvos ≥ 48 px.

### D-12 Ícones diferentes por estado
Sadia ✓ círculo, Leve ! círculo, Moderada ⚠ triângulo, Grave ⯃ octógono — além da cor e do texto, para daltonismo e sol forte.

### D-13 "O que fazer agora" são orientações gerais
Baseadas em práticas amplamente divulgadas para a bacteriose (manivas sadias, limpeza de ferramentas, observar plantas vizinhas,
procurar técnico/agrônomo). **Não** há recomendação de produto químico. Suposição: a equipe deve validar o texto com um agrônomo.

### D-14 Conta é opcional e simulada
`MockAuthService` guarda as contas só no navegador, com senha em **PBKDF2-SHA-256 + sal** (mesmo sendo mock), mensagem única
para e-mail/senha errados, mínimo de 8 caracteres. "Usar sem conta" sempre visível. Será trocado pelo Supabase Auth.

### D-15 Localização e mapa de calor atrás de flags
`VITE_FEATURE_GEOLOCATION` e `VITE_FEATURE_HEATMAP` (desligadas). A localização é arredondada para ~1 km (2 casas decimais)
e só é lida com consentimento explícito; recusar não muda nenhuma função. O mapa usa **dados fictícios**, rotulados na tela.
O contorno do Vale do Ribeira no mapa é esquemático, não oficial.

### D-16 Idioma
PT-BR padrão; EN completo (para o pitch com legendas PT + EN). O idioma inicial segue o navegador e pode ser trocado no Perfil.
Um teste garante que as duas línguas têm as mesmas chaves e marcadores.

### D-17 Segurança no build
CSP injetada no `index.html` só no build (o servidor de desenvolvimento do Vite precisa de scripts inline);
`connect-src` libera apenas a origem de `VITE_API_URL`. `public/_headers` e `vercel.json` trazem a mesma política com
`frame-ancestors 'none'`, HSTS e `nosniff` para a hospedagem. Ver [seguranca-owasp.md](seguranca-owasp.md).

### D-18 Dependências
Migrado para **React Router 7** e **zod 4** porque as versões 6/3 tinham alertas do `npm audit` em produção.
`npm audit --omit=dev` = 0. Restam alertas só em ferramentas de desenvolvimento (Vitest 2 / Vite 5 dev server);
atualizar para Vitest 3+/Vite 6+ quando o `vite-plugin-pwa` for atualizado junto.

### D-19 Telas antigas
Usadas só como referência de fluxo e conteúdo. Descartados: nome AVASS, amarelo com preto, menu lateral escuro,
"ESCANEANDO" com porcentagem falsa (substituído por etapas reais), "Chance de perdas" e "Imagens semelhantes" (a API não calcula),
login com Facebook e erros de digitação. Um teste impede que esses termos voltem aos textos.

## 28/10/2026 — back-end (Supabase) e integração com a IA v2

### D-20 Projeto Supabase exclusivo do app e como as migrações foram testadas
Criado o projeto **`greenleaf-app`** (`mfngcmjgisfgttsgqyfl`, `sa-east-1`, plano gratuito, US$ 0/mês), separado do projeto
`Axios_Cassava_IA` (logs técnicos da IA, `prediction_logs`), que não foi tocado. O plano gratuito não tem *branching* e,
nesta máquina, não havia CLI do Supabase nem Docker ativo para `supabase start`. Como o projeto acabara de ser criado e estava
**vazio**, as migrações foram aplicadas direto nele pela ferramenta de migração do plugin, e os arquivos em
`supabase/migrations/` têm as mesmas versões registradas no banco. A segurança foi verificada de três jeitos:
`supabase/tests/rls.test.sql` (transação com `ROLLBACK`), `scripts/supabase-e2e.mjs` (23 verificações pela API pública com dois
usuários de teste) e os advisors do plugin. Os usuários de teste foram apagados no fim pela própria `delete-account`.

### D-21 IA v2 publicada na Render
Merge do PR #6 da IA (`pytest`: 7 passaram, 1 pulado) e do PR #1 do app. Serviço **`greenleaf-ia`** (Web Service Docker,
plano gratuito, `backend/Dockerfile`, branch `main`, deploy automático) com `APP_ENV=production`, `TTA=true`,
`ANALYSIS_MAX_SIDE=768`. Sem `CONFIDENCE_THRESHOLD`/`MODEL_WEIGHT`, para valerem os valores calibrados.
`GET /health` → `model_loaded: true`, `model_version: greenleaf_effb0-2026-10-28`. **`POST /predict` com o servidor acordado:
1,8 s a 2,4 s** (3 medições), abaixo da meta O3 de 5 s, então **`TTA` continua ligado**. No plano gratuito o serviço dorme;
a primeira chamada depois disso demora mais (o app já mostra "servidor acordando").
**SUPOSIÇÃO:** o app ainda não está publicado na Vercel, então `CORS_ORIGINS=https://greenleaf-mobile.vercel.app` (domínio
padrão provável). Se o domínio for outro, troque essa variável na Render; `localhost` não foi liberado.

### D-22 Esquema do banco
Nomes em inglês (`profiles`, `analyses`, `locations`, `feedback`), atualizando o diagrama dos Artefatos (`usuario`, `analise`,
`localizacao`) para a IA v2 — ver [diagrama-banco.md](diagrama-banco.md). Regras no próprio banco, além das do app: `check` em
todos os enums e faixas; `sadia` ⇔ sem severidade; `other_disease` só com `sadia`; `source` só `camera` ou `gallery`, de modo que
**demonstração não entra nem por engano**; `image_path`/`overlay_path` obrigatoriamente dentro de `{user_id}/{id}/`. O
`created_at` vem do app, para a análise feita offline manter a hora em que foi feita. Histórico **imutável** (sem `UPDATE`).

### D-23 Mapa de calor agregado
`heatmap_cells()` agrupa numa grade de 0,045° (cerca de 5 km), devolve o centro da célula, o total e o total com bacteriose, e só
inclui células com **5 ou mais** análises com consentimento. O advisor apontou função `SECURITY DEFINER` exposta na API
(lints 0028/0029). A função com privilégio foi para o esquema `private`, que o PostgREST não publica, e `public.heatmap_cells()`
virou `SECURITY INVOKER`, só repassando o agregado. `anon` pode chamar: o dado é agregado e público por natureza.

### D-24 Exclusão de conta e exportação (LGPD)
`delete-account` valida o JWT, apaga `leaves/{user_id}/…` e chama `auth.admin.deleteUser`. Perfil, análises e localizações
saem por `ON DELETE CASCADE`, e o feedback fica, mas anônimo (`on delete set null`). A chave service role existe só no servidor do
Supabase. `export-data` usa o **JWT do próprio usuário com a chave anônima**, então a RLS garante o escopo e ela não precisa de
service role. **PENDENTE:** não há botão de exportar na tela, porque a única mudança de interface permitida neste ciclo era o
aviso de envio do histórico. A exportação já funciona pela API e foi testada.

### D-25 Autenticação
E-mail e senha, **confirmação de e-mail ligada** (padrão do Supabase, não foi desligada) e rate limit padrão. O app exige 8
caracteres, como o mock. Novo `AuthError` `confirm_email`, com texto em PT e EN, para "confira seu e-mail". O login responde
`invalid_credentials` para e-mail inexistente e para senha errada. No cadastro, e-mail repetido vira `email_taken`, como no
mock; isso revela que o e-mail existe, o que foi aceito para o PI. **Ajustes manuais no painel (sem ferramenta no plugin):**
senha mínima 8 também no servidor (o padrão do Supabase é 6), *Site URL*/*Redirect URLs* com o domínio da Vercel e **SMTP
próprio**, porque o SMTP padrão só entrega para membros da organização. Sem SMTP, a alternativa para a demonstração é desligar a
confirmação; se isso for feito, registre aqui.

### D-26 Histórico composto e fila offline
`SessionAwareAnalysisRepository` funciona assim: sem login, o `LocalAnalysisRepository` de sempre; com login, o
`CloudAnalysisRepository`. Sem internet, ou se a rede cai no meio do envio, a análise vai para uma fila em IndexedDB **por
usuário** (`greenleaf-outbox-{id}`), para não misturar contas no mesmo aparelho, e sobe no evento `online` ou na próxima
listagem. Envio idempotente: `upsert … ignoreDuplicates` pelo `id` e arquivo já existente no Storage tratado como sucesso.
Recusa definitiva do banco (erros 22/23/42) não fica tentando para sempre: a análise volta para o histórico do aparelho.
Demonstração e resultado simulado ficam sempre só no aparelho. Sem internet e com login, o histórico mostra a fila e as
demonstrações em vez de uma tela de erro. **"Apagar dados deste aparelho"** limpa o aparelho e a fila, **não** a conta; a
nuvem sai por exclusão da análise ou da conta. `CloudAnalysisRepository.clear()` apaga só o que é do usuário logado.

### D-27 Nível de risco em vez de porcentagem
Com o limiar calibrado em 0,26, o app mostraria "33% de chance" ao lado de "Sinais de bacteriose". `Diagnosis.riskLevel`:
**baixo** (< 0,26), **médio** (0,26 a 0,60) e **alto** (> 0,60), calculado sobre a probabilidade **sem arredondar** (0,255 é baixo,
mesmo aparecendo como "26%"). A tela principal mostra o nível; a porcentagem e a classe mais provável (`diagnosis`) ficam em
"Detalhes técnicos". O texto de compartilhar também usa o nível. O limite de 0,60 para "alto" é escolha de interface, não
calibrado; a equipe pode revisar.

### D-28 Envio do histórico local no primeiro login (único ajuste de interface)
Componente novo `src/app/HistorySyncPrompt.tsx`: depois do login, se há análises locais (fora da demonstração), pergunta
"Enviar minhas análises deste aparelho para a conta?" (**Enviar para a conta** / **Agora não**). Pergunta uma vez por conta
neste aparelho (`gl.sync.asked.{id}`). "Enviar" **move**: sobe e tira do aparelho, para não duplicar. O `ConfirmDialog` ganhou
`cancelLabel` opcional. Além disso, três textos que diziam "só neste aparelho" passaram a depender de `Services.accountMode`
(`auth.subtitle.cloud`, `history.subtitle.cloud`, `support.sentBody.cloud`). Muda só o texto, não o layout.

### D-29 Demonstração com respostas reais da IA v2
As respostas foram gravadas do **servidor publicado na Render** (mesma imagem Docker e configuração). O `onnxruntime` local
falhou no Windows por caminho longo, e o Docker local estava parado. `scripts/record-demo.mjs` refaz a gravação. Resultado
**honesto**, sem ajuste: as ilustrações geradas por computador (D-04) "leve" e "moderada" agora saem como **Sadia (p = 0,13)** e
**Leve (p = 0,33)**, e "grave" continua **Grave**. Por isso o rótulo de cada exemplo vem da resposta real, não do nome do arquivo.
5º exemplo: foto `1226263276.jpg` (CMD) do conjunto de **teste** da IA (`training/data/splits.csv`), que sai como **Sem bacteriose
— mosaico (CMD 91%)**. Overlays PNG antigos trocados pelos JPEG v2 com o contorno amarelo.
**SUPOSIÇÃO:** a equipe pode trocar as ilustrações 1 a 4 por fotos reais e rodar o script de novo.

### D-30 Textos de "Saiba mais"
Números tirados do `README.md` e de `training/reports/metrics.md` da IA: EfficientNet-B0 em ONNX, 5 classes, 21.397 fotos de
campo de Uganda, revocação de 78% e especificidade de 95,5% na bacteriose (2.140 fotos de teste). As limitações agora dizem que
a severidade vem da cor, que a meta de 90% de revocação ainda não foi atingida, que não houve teste no Vale do Ribeira e que o app
não recusa fotos que não são de mandioca. A lista passou de 5 para 7 itens.

### D-31 CSP com as origens reais
`vercel.json` e `public/_headers` liberam em `connect-src` a IA (`https://greenleaf-ia.onrender.com`) e o Supabase do app, e em
`img-src` só o Supabase (URLs assinadas). Antes, o `vercel.json` liberava só `'self'`, o que bloquearia a própria API na Vercel.
A CSP do `<meta>` é montada no build a partir de `VITE_API_URL` e `VITE_SUPABASE_URL`. Sem `unsafe-*`.

### D-32 Tipos do banco e dados novos da IA
`src/data/supabase.types.ts` foi gerado pelo plugin e é usado pelas classes `Supabase*`/`Cloud*`. Ficaram declarados no app
`HealthStatus.model_version?`, `PredictionResult.diagnosis?` e `class_probabilities?` (opcionais no zod). `Analysis` ganhou
`classProbabilities` e `topClass`. As 5 probabilidades vão para `analyses.class_probabilities` na nuvem. O nome da classe é
traduzido no app pelo código (`class.CBB`…), porque o `label` do servidor vem só em português.

### D-33 App publicado na Vercel
Projeto **`greenleaf-mobile`** (time `yajoojjs-projects`, plano Hobby), ligado ao repositório `Yajoojj/Greenleaf-Mobile`.
Endereço: **https://greenleaf-mobile.vercel.app**, o mesmo já usado em `CORS_ORIGINS` (D-21) e na CSP (D-31), então nada
precisou mudar na Render. Variáveis em Production e Preview: `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
(tipo *config*: a chave anônima é pública por definição; quem protege os dados é a RLS) e as duas flags **ligadas**
(`VITE_FEATURE_GEOLOCATION`, `VITE_FEATURE_HEATMAP`), porque agora a localização tem consentimento no banco e o mapa só mostra
agregado (D-23). O plugin da Vercel não tinha acesso ao time, então o projeto foi criado e publicado pela CLI já logada.
Como a `main` ainda não tem a integração, a primeira versão de produção foi publicada **a partir desta branch**
(`vercel deploy --prod`); depois do merge do PR #2, cada push na `main` publica sozinho. Verificado no endereço publicado:
CSP sem erro, `POST /predict` (2,6 s) e `heatmap_cells` respondendo a partir da origem da Vercel.

### D-34 Manter a IA acordada (cron-job.org)
No plano gratuito a Render "dorme" depois de ~15 min sem uso, e o primeiro `/predict` depois disso levou 22 s (pode chegar a
~1 min). Entre o plano Starter (US$ 7/mês) e um "despertador" gratuito, a equipe escolheu o **gratuito**: tarefa
"GreenLeaf IA – manter acordada" no **cron-job.org** (conta da equipe), `GET https://greenleaf-ia.onrender.com/health` a cada
**10 minutos** (`*/10 * * * *`, fuso America/Sao_Paulo), sem cabeçalhos nem autenticação (o `/health` não expõe dado
sensível). As 750 h/mês grátis da Render cobrem um serviço ligado 24 h. Não usamos GitHub Actions agendado porque o horário
atrasa e o GitHub desliga agendamentos de repositórios parados. O app não depende disso: `useServerStatus` já chama `/health`
ao abrir e mostra "Servidor acordando". Se o app passar a ter uso real, trocar pelo plano pago e desativar a tarefa.

## Modelo para próximos registros

| Data | Atividades realizadas | Dificuldades / decisões | Responsável |
|---|---|---|---|
| dd/mm | | | |
