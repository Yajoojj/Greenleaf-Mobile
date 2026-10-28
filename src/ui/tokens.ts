/**
 * Design tokens do GreenLeaf — fonte única de verdade (espelhada em tokens.css).
 * Nomes no formato `categoria.nome.escala` para recriar como Variables/Styles no Figma.
 * Base: Artefatos do Projeto de Software, Tabelas 3 e 4.
 */
export const color = {
  // Verde da marca (#57B846 = color.primary dos Artefatos). Texto branco só a partir do 700.
  green: {
    50: '#EFF8EC',
    100: '#DAF0D4',
    200: '#B5E1AB',
    300: '#8ED07F',
    400: '#6FC25F',
    500: '#57B846',
    600: '#43993A',
    700: '#2F7A28',
    800: '#24611F',
    900: '#1A4716',
  },
  // Âmbar (#F2B134 = color.warning) — infecção Leve
  amber: {
    50: '#FEF6E4',
    100: '#FCE9BF',
    300: '#F6CB6F',
    500: '#F2B134',
    700: '#946200',
    800: '#7A5100',
  },
  // Laranja (novo) — infecção Moderada
  orange: {
    50: '#FFF0E5',
    100: '#FFDCC2',
    300: '#F9A762',
    500: '#F07C1E',
    700: '#B04F00',
    800: '#943F00',
  },
  // Vermelho (#FF5D5D = color.error) — infecção Grave e erros
  red: {
    50: '#FFEDED',
    100: '#FFD3D3',
    300: '#FF9494',
    500: '#FF5D5D',
    700: '#C42B2B',
    800: '#A11D1D',
  },
  // Neutros (#484848 = color.text, #F5F5F5 = color.background)
  neutral: {
    0: '#FFFFFF',
    50: '#F5F5F5',
    100: '#EBEBEB',
    200: '#DADADA',
    300: '#C2C2C2',
    500: '#767676',
    600: '#5E5E5E',
    700: '#484848',
    900: '#1F1F1F',
  },
} as const;

/** Papéis semânticos usados pelos componentes. */
export const semantic = {
  'text.default': color.neutral[700],
  'text.muted': color.neutral[600],
  'text.onPrimary': color.neutral[0],
  'surface.page': color.neutral[50],
  'surface.card': color.neutral[0],
  'surface.sunken': color.neutral[100],
  'border.default': color.neutral[200],
  'action.primary': color.green[700],
  'action.primaryPressed': color.green[800],
  'focus.ring': color.green[900],
} as const;

/** Cor, fundo e texto de cada estado do diagnóstico (sempre acompanhados de ícone + texto). */
export const diagnosisTone = {
  sadia: { base: color.green[500], surface: color.green[50], text: color.green[800] },
  leve: { base: color.amber[500], surface: color.amber[50], text: color.amber[800] },
  moderada: { base: color.orange[500], surface: color.orange[50], text: color.orange[800] },
  grave: { base: color.red[500], surface: color.red[50], text: color.red[800] },
} as const;

/** Escala tipográfica normalizada (Montserrat). Título 29,51 → 30; corpo 18,04 → 18. */
export const font = {
  family: "'Montserrat', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  size: { xs: 14, sm: 16, md: 18, lg: 20, xl: 24, '2xl': 30, '3xl': 36 },
  weight: { regular: 400, medium: 500, semibold: 600, bold: 700 },
  lineHeight: { tight: 1.2, normal: 1.5 },
} as const;

export const space = { 1: 4, 2: 8, 3: 16, 4: 24, 5: 32 } as const;
export const radius = { md: 12, pill: 999 } as const;
export const touchTarget = 48;
