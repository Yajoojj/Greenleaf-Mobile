import { useEffect, useState } from 'react';
import { PredictionError } from '../domain/errors';
import type { HealthStatus } from '../domain/types';
import { useServices } from './services';

export function useOnline(): boolean {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

export type ServerState =
  | { kind: 'checking' }
  | { kind: 'ok'; health: HealthStatus }
  | { kind: 'sleeping' }
  | { kind: 'down' }
  | { kind: 'offline' };

/**
 * Consulta GET /health. Se o servidor estiver dormindo, a própria consulta já o acorda;
 * tentamos de novo algumas vezes para o produtor ver quando ficou pronto.
 */
export function useServerStatus(): ServerState {
  const { prediction } = useServices();
  const online = useOnline();
  const [state, setState] = useState<ServerState>({ kind: 'checking' });

  useEffect(() => {
    if (!online) {
      setState({ kind: 'offline' });
      return;
    }
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    const check = () => {
      prediction.health().then(
        (health) => alive && setState({ kind: 'ok', health }),
        (err) => {
          if (!alive) return;
          const kind = err instanceof PredictionError ? err.kind : 'server';
          if ((kind === 'sleeping' || kind === 'timeout') && attempts < 6) {
            attempts += 1;
            setState({ kind: 'sleeping' });
            timer = setTimeout(check, 10_000);
          } else {
            setState({ kind: kind === 'offline' ? 'offline' : 'down' });
          }
        },
      );
    };
    setState({ kind: 'checking' });
    check();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [prediction, online]);

  return state;
}

/** Evento de instalação do PWA (Chrome/Edge/Android). */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    listeners.forEach((l) => l());
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    listeners.forEach((l) => l());
  });
}

export function useInstallPrompt(): { canInstall: boolean; installed: boolean; install: () => Promise<void> } {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  const installed = typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone)').matches === true;
  return {
    canInstall: deferredPrompt !== null,
    installed,
    install: async () => {
      if (!deferredPrompt) return;
      await deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
      force((n) => n + 1);
    },
  };
}
