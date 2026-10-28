# Design system GreenLeaf (para o Figma)

Fonte da verdade: `src/ui/tokens.ts` (espelhado em `src/ui/tokens.css`, verificado por teste).
Os nomes abaixo podem ser criados no Figma como **Variables** (cores, números) e **Components** com as mesmas variantes.

## Tokens

### Cores — coleção `color`

| Variável | Hex | Uso |
|---|---|---|
| `green/500` | `#57B846` | Marca (color.primary dos Artefatos), barras, folha no overlay |
| `green/700` | `#2F7A28` | **Fundo do botão primário** (branco passa 5,3:1) |
| `green/800` | `#24611F` | Links, texto de "Sadia", hero |
| `green/50` | `#EFF8EC` | Fundo do selo Sadia |
| `amber/500` | `#F2B134` | Leve (borda/barra) — color.warning |
| `amber/800` | `#7A5100` | Texto de "Leve" e do selo Demonstração |
| `orange/500` | `#F07C1E` | Moderada (novo) |
| `orange/800` | `#943F00` | Texto de "Moderada" |
| `red/500` | `#FF5D5D` | Grave — color.error |
| `red/800` | `#A11D1D` | Texto de "Grave" e de erros |
| `neutral/700` | `#484848` | Texto — color.text |
| `neutral/600` | `#5E5E5E` | Texto secundário |
| `neutral/50` | `#F5F5F5` | Fundo — color.background |
| `neutral/0` | `#FFFFFF` | Cartões |

Escalas completas (50–900) em `tokens.ts`.

### Papéis semânticos — coleção `semantic`
`text/default`, `text/muted`, `text/onPrimary`, `surface/page`, `surface/card`, `surface/sunken`, `border/default`,
`action/primary`, `action/primaryPressed`, `focus/ring`.

### Tipografia — Montserrat
| Estilo | Tamanho | Peso | Uso |
|---|---|---|---|
| `title/2xl` | 30 | Bold | Título da tela |
| `title/xl` | 24 | Bold | Seção |
| `title/lg` | 20 | SemiBold | Cartão |
| `body/md` | 18 | Regular | Texto padrão |
| `body/sm` | 16 | Regular/Medium | Apoio, rótulos |
| `caption/xs` | 14 | SemiBold | Navegação inferior, legendas curtas |
| `button/md` | 18 | SemiBold | Botões |

### Espaço e forma
`space/1..5` = 4, 8, 16, 24, 32 · `radius/md` = 12 · `radius/pill` = 999 · `touch/min` = 48.

## Componentes (nome no Figma → arquivo)

| Componente | Variantes | Arquivo |
|---|---|---|
| `Button` | Primary, Secondary, Ghost, Danger × Default, Pressed, Disabled, Loading × md, lg | `ui/components/Button.tsx` |
| `DiagnosisBadge` | Sadia, Leve, Moderada, Grave × Small, Large | `ui/components/DiagnosisBadge.tsx` |
| `SeverityScale` | estado atual | `ui/components/DiagnosisBadge.tsx` |
| `DiagnosisCard` | cabeçalho, métricas, imagem, explicação, o que fazer, aviso | `pages/parts/DiagnosisView.tsx` |
| `ImageCompare` | Área destacada, Foto original | `ui/components/ImageCompare.tsx` |
| `StatusMessage` | Info, Success, Warning, Error × ícone (offline, servidor dormindo) | `ui/components/StatusMessage.tsx` |
| `ProgressSteps` | Step Pending, Active, Done | `ui/components/ProgressSteps.tsx` |
| `HistoryItem` | miniatura, data, estado | `ui/components/HistoryItem.tsx` |
| `ServerStatus` | Ok, Waking, Down, Offline, Mock, Demo | `ui/components/ServerStatusPill.tsx` |
| `SegmentedControl`, `Chip`, `Switch`, `TextField`, `ConfirmDialog` | — | `ui/components/*` |

## Regras

1. Gravidade **sempre** com cor + ícone + texto (ícones de formas diferentes: círculo ✓, círculo !, triângulo, octógono).
2. Texto ≥ 4,5:1 — texto de estado usa o tom 800 sobre o tom 50.
3. Ação principal na metade de baixo da tela (barra fixa acima da navegação).
4. Um assunto por tela; termos técnicos só em "Saiba mais" e "Detalhes técnicos".
5. Fotos reais nas telas de produto; nenhuma tela gerada por IA apresentada como captura do app.
