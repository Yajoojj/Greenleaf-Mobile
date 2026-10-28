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

## Modelo para próximos registros

| Data | Atividades realizadas | Dificuldades / decisões | Responsável |
|---|---|---|---|
| dd/mm | | | |
