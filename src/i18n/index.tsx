import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { en } from './en';
import { ptBR, type MessageKey, type Messages } from './pt-BR';

export type Locale = 'pt-BR' | 'en';
export const LOCALES: Locale[] = ['pt-BR', 'en'];

const DICTIONARIES: Record<Locale, Messages> = { 'pt-BR': ptBR, en };

export type Translate = (key: MessageKey, vars?: Record<string, string | number>) => string;

export function translate(locale: Locale, key: MessageKey, vars?: Record<string, string | number>): string {
  const template = DICTIONARIES[locale][key] ?? ptBR[key] ?? key;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => (name in vars ? String(vars[name]) : `{${name}}`));
}

interface I18nValue {
  locale: Locale;
  t: Translate;
  formatDate: (iso: string) => string;
  formatNumber: (n: number, digits?: number) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const t = useCallback<Translate>((key, vars) => translate(locale, key, vars), [locale]);
  const value = useMemo<I18nValue>(() => {
    const dateFmt = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' });
    return {
      locale,
      t,
      formatDate: (iso) => dateFmt.format(new Date(iso)),
      formatNumber: (n, digits = 0) =>
        new Intl.NumberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n),
    };
  }, [locale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n fora do I18nProvider');
  return ctx;
}

export type { MessageKey };
