import { render } from '@testing-library/react';
import axe from 'axe-core';
import { IDBFactory } from 'fake-indexeddb';
import type { ReactElement } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi } from 'vitest';
import { AppProviders } from '../app/App';
import type { Settings } from '../app/settings';
import { LocalAnalysisRepository } from '../data/LocalAnalysisRepository';
import type { Services } from '../domain/services';
import type { Analysis, PredictionResult } from '../domain/types';

export const OVERLAY = 'data:image/png;base64,iVBORw0KGgo=';

export function prediction(patch: Partial<PredictionResult> = {}): PredictionResult {
  return {
    probability: 0.42,
    model_probability: 0.7,
    hsv_probability: 0.3,
    class: 'Infectado',
    ratio: 0.078,
    severity: 'Moderada',
    processing_time_ms: 800,
    overlay: OVERLAY,
    ...patch,
  };
}

export function analysis(patch: Partial<Analysis> = {}): Analysis {
  return {
    id: 'a1',
    createdAt: '2026-10-20T13:30:00.000Z',
    state: 'moderada',
    probability: 0.42,
    modelProbability: 0.7,
    hsvProbability: 0.3,
    ratio: 0.078,
    severity: 'Moderada',
    processingTimeMs: 800,
    imageDataUrl: 'data:image/jpeg;base64,AA==',
    overlayDataUrl: OVERLAY,
    ...patch,
  };
}

/** Serviços dublês: nada de rede, IndexedDB em memória. */
export function fakeServices(patch: Partial<Services> = {}): Services {
  return {
    prediction: { predict: vi.fn().mockResolvedValue(prediction()), health: vi.fn().mockResolvedValue({ status: 'ok', version: 't', environment: 'test', model_loaded: true, supabase_logging: false }) },
    analyses: new LocalAnalysisRepository(new IDBFactory()),
    auth: { signUp: vi.fn(), signIn: vi.fn(), signOut: vi.fn().mockResolvedValue(undefined), currentUser: vi.fn().mockResolvedValue(null), deleteAccount: vi.fn() },
    location: { requestConsent: vi.fn().mockResolvedValue(false), getPosition: vi.fn().mockResolvedValue(null), revokeConsent: vi.fn().mockResolvedValue(undefined), consentStatus: vi.fn().mockResolvedValue(false) },
    feedback: { send: vi.fn().mockResolvedValue(undefined) },
    images: { validate: vi.fn(), prepare: vi.fn(async (b: Blob) => b), toDataUrl: vi.fn().mockResolvedValue('data:image/jpeg;base64,AA==') },
    predictionMode: 'api',
    ...patch,
  };
}

const DEFAULT_SETTINGS: Partial<Settings> = { locale: 'pt-BR', onboardingDone: true, authSeen: true, demoMode: false };

export function renderPage(
  element: ReactElement,
  { path = '/', route = path, services = fakeServices(), settings }: { path?: string; route?: string; services?: Services; settings?: Partial<Settings> } = {},
) {
  const utils = render(
    <AppProviders services={services} settings={{ ...DEFAULT_SETTINGS, ...settings }}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path={path} element={element} />
          <Route path="*" element={<p>outra rota</p>} />
        </Routes>
      </MemoryRouter>
    </AppProviders>,
  );
  return { ...utils, services };
}

/** Roda o axe-core (regras WCAG A/AA) no container renderizado. */
export async function axeViolations(container: Element) {
  const result = await axe.run(container, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
    rules: { 'color-contrast': { enabled: false } }, // jsdom não calcula estilos; contraste é testado em tokens.test.ts
  });
  return result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
}
