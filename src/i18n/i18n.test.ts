import { describe, expect, it } from 'vitest';
import { en } from './en';
import { translate } from './index';
import { ptBR } from './pt-BR';

describe('i18n', () => {
  it('EN tem exatamente as mesmas chaves do PT-BR', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(ptBR).sort());
  });

  it('nenhum texto vazio e os mesmos marcadores {x} nos dois idiomas', () => {
    for (const key of Object.keys(ptBR) as (keyof typeof ptBR)[]) {
      expect(ptBR[key].trim(), key).not.toBe('');
      expect(en[key].trim(), key).not.toBe('');
      const vars = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
      expect(vars(en[key]), key).toEqual(vars(ptBR[key]));
    }
  });

  it('não usa o nome antigo nem erros de digitação das telas antigas', () => {
    const all = [...Object.values(ptBR), ...Object.values(en)].join(' ');
    expect(all).not.toMatch(/AVASS|Grenn|phaesoli|Facebook/i);
  });

  it('interpola variáveis', () => {
    expect(translate('pt-BR', 'home.hello', { name: 'Ana' })).toBe('Olá, Ana!');
    expect(translate('en', 'history.count', { n: 3 })).toBe('3 analyses');
  });
});
