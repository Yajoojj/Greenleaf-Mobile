import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { color, diagnosisTone, semantic } from './tokens';

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const AA = 4.5;

describe('contraste de texto ≥ 4,5:1 (WCAG AA)', () => {
  it('branco sobre o verde original #57B846 NÃO passa — por isso o botão usa green.700', () => {
    expect(contrast(color.neutral[0], color.green[500])).toBeLessThan(AA);
    expect(contrast(semantic['text.onPrimary'], semantic['action.primary'])).toBeGreaterThanOrEqual(AA);
    expect(contrast(semantic['text.onPrimary'], semantic['action.primaryPressed'])).toBeGreaterThanOrEqual(AA);
  });

  it.each([
    ['texto padrão / fundo da página', semantic['text.default'], semantic['surface.page']],
    ['texto padrão / cartão', semantic['text.default'], semantic['surface.card']],
    ['texto secundário / fundo da página', semantic['text.muted'], semantic['surface.page']],
    ['texto secundário / cartão', semantic['text.muted'], semantic['surface.card']],
    ['texto secundário / superfície rebaixada', semantic['text.muted'], color.neutral[100]],
    ['link green.800 / fundo', color.green[800], semantic['surface.page']],
    ['botão secundário green.800 / branco', color.green[800], color.neutral[0]],
    ['erro red.800 / red.50', color.red[800], color.red[50]],
    ['selo demonstração amber.800 / amber.100', color.amber[800], color.amber[100]],
    ['texto branco / hero green.800', color.neutral[0], color.green[800]],
    ['green.50 / hero green.800', color.green[50], color.green[800]],
    ['título neutral.900 / amber.50', color.neutral[900], color.amber[50]],
  ])('%s', (_, fg, bg) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(AA);
  });

  it.each(Object.entries(diagnosisTone))('selo de diagnóstico "%s": texto sobre a superfície', (_, tone) => {
    expect(contrast(tone.text, tone.surface)).toBeGreaterThanOrEqual(AA);
  });
});

describe('tokens.css espelha tokens.ts', () => {
  const css = readFileSync(resolve(__dirname, 'tokens.css'), 'utf-8');
  it.each(Object.entries(color).flatMap(([name, scale]) => Object.entries(scale).map(([step, hex]) => [`--color-${name}-${step}`, hex])))(
    '%s = %s',
    (varName, hex) => {
      expect(css).toMatch(new RegExp(`${varName}:\\s*${hex};`, 'i'));
    },
  );
});
