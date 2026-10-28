import type { LocationService } from '../domain/services';

const CONSENT_KEY = 'gl.location.consent';

/**
 * Localização da análise (futuro mapa de calor, flag FEATURE_GEOLOCATION).
 * Só lê a posição com consentimento explícito e arredonda para ~1 km (2 casas decimais),
 * o suficiente para um mapa regional sem expor a localização exata da lavoura.
 */
export class BrowserLocationService implements LocationService {
  constructor(private readonly storage: Storage = localStorage) {}

  hasConsent(): boolean {
    return this.storage.getItem(CONSENT_KEY) === 'granted';
  }

  /**
   * Chamado depois que o produtor tocou em "Permitir" na nossa tela de explicação:
   * só então o navegador mostra o pedido de permissão dele.
   */
  async requestConsent(): Promise<boolean> {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) return false;
    const granted = await new Promise<boolean>((resolve) => {
      navigator.geolocation.getCurrentPosition(() => resolve(true), (err) => resolve(err.code !== err.PERMISSION_DENIED), {
        enableHighAccuracy: false,
        timeout: 15000,
        maximumAge: 10 * 60 * 1000,
      });
    });
    this.storage.setItem(CONSENT_KEY, granted ? 'granted' : 'denied');
    return granted;
  }

  async revokeConsent(): Promise<void> {
    this.storage.setItem(CONSENT_KEY, 'denied');
  }

  async consentStatus(): Promise<boolean> {
    return this.hasConsent();
  }

  async getPosition(): Promise<{ latitude: number; longitude: number } | null> {
    if (!this.hasConsent() || typeof navigator === 'undefined' || !('geolocation' in navigator)) return null;
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({
          latitude: Math.round(pos.coords.latitude * 100) / 100,
          longitude: Math.round(pos.coords.longitude * 100) / 100,
        }),
        () => resolve(null),
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 10 * 60 * 1000 },
      );
    });
  }
}

/** Usado quando a flag está desligada: nunca pede nem lê localização. */
export class DisabledLocationService implements LocationService {
  async requestConsent(): Promise<boolean> {
    return false;
  }

  async revokeConsent(): Promise<void> {}

  async consentStatus(): Promise<boolean> {
    return false;
  }

  async getPosition(): Promise<null> {
    return null;
  }
}
