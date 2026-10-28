import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = resolve(__dirname, '..');

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [p] : [];
  });
}

const importsOf = (file: string) => [...readFileSync(file, 'utf-8').matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);

describe('arquitetura', () => {
  it('nenhuma tela importa implementação concreta de serviço ou repositório', () => {
    const offenders = [...files(join(SRC, 'pages')), ...files(join(SRC, 'ui'))].flatMap((f) =>
      importsOf(f)
        .filter((i) => /(^|\/)(services|data)\//.test(i) || /ServiceFactory/.test(i))
        .map((i) => `${f.replace(SRC, 'src')} → ${i}`),
    );
    expect(offenders).toEqual([]);
  });

  it('o domínio não depende de React, de telas nem de implementações', () => {
    const offenders = files(join(SRC, 'domain')).flatMap((f) =>
      importsOf(f)
        .filter((i) => i === 'react' || /(pages|ui|services|data|config|app)\//.test(i))
        .map((i) => `${f.replace(SRC, 'src')} → ${i}`),
    );
    expect(offenders).toEqual([]);
  });

  it('somente config/ServiceFactory instancia classes concretas', () => {
    const concrete = /new (Http|Mock|Demo|Local|Browser|Disabled)\w*(Service|Repository|Preparer)\(/;
    const offenders = files(SRC)
      .filter((f) => !f.includes('ServiceFactory') && !/[\\/](services|data|test)[\\/]/.test(f))
      .filter((f) => concrete.test(readFileSync(f, 'utf-8')));
    expect(offenders).toEqual([]);
  });

  it('nenhum HTML vindo de fora é injetado (dangerouslySetInnerHTML/innerHTML)', () => {
    const offenders = files(SRC).filter((f) => /dangerouslySetInnerHTML|\.innerHTML\s*=/.test(readFileSync(f, 'utf-8')));
    expect(offenders).toEqual([]);
  });
});
