import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Locale } from '../i18n';

export interface Settings {
  locale: Locale;
  demoMode: boolean;
  onboardingDone: boolean;
  /** Já passou pela tela de entrar (com conta ou "usar sem conta"). */
  authSeen: boolean;
  /** Já respondeu à tela de consentimento de localização. */
  locationAsked: boolean;
}

const KEY = 'gl.settings';

function detectLocale(): Locale {
  return typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('en') ? 'en' : 'pt-BR';
}

export function loadSettings(storage: Storage = localStorage): Settings {
  const defaults: Settings = { locale: detectLocale(), demoMode: false, onboardingDone: false, authSeen: false, locationAsked: false };
  try {
    const raw = JSON.parse(storage.getItem(KEY) ?? '{}') as Partial<Settings>;
    return {
      locale: raw.locale === 'en' || raw.locale === 'pt-BR' ? raw.locale : defaults.locale,
      demoMode: raw.demoMode === true,
      onboardingDone: raw.onboardingDone === true,
      authSeen: raw.authSeen === true,
      locationAsked: raw.locationAsked === true,
    };
  } catch {
    return defaults;
  }
}

interface SettingsValue {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
}

const SettingsContext = createContext<SettingsValue | null>(null);

export function SettingsProvider({ children, initial }: { children: ReactNode; initial?: Partial<Settings> }) {
  const [settings, setSettings] = useState<Settings>(() => ({ ...loadSettings(), ...initial }));
  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* armazenamento cheio ou bloqueado: segue só em memória */
      }
      return next;
    });
  }, []);
  const value = useMemo(() => ({ settings, update }), [settings, update]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings fora do SettingsProvider');
  return ctx;
}
