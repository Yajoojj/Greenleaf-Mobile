import { useEffect, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { flags } from '../config/env';
import type { Services } from '../domain/services';
import { I18nProvider, useI18n } from '../i18n';
import { AuthPage } from '../pages/AuthPage';
import { CapturePage } from '../pages/CapturePage';
import { HeatmapPage } from '../pages/HeatmapPage';
import { HistoryDetailPage } from '../pages/HistoryDetailPage';
import { HistoryPage } from '../pages/HistoryPage';
import { HomePage } from '../pages/HomePage';
import { InstallPage } from '../pages/InstallPage';
import { LearnPage } from '../pages/LearnPage';
import { LocationConsentPage } from '../pages/LocationConsentPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { ProcessingPage } from '../pages/ProcessingPage';
import { ProfilePage } from '../pages/ProfilePage';
import { ResultPage } from '../pages/ResultPage';
import { SupportPage } from '../pages/SupportPage';
import { WelcomePage } from '../pages/WelcomePage';
import { AuthProvider } from './auth';
import { HistorySyncPrompt } from './HistorySyncPrompt';
import { Layout } from './Layout';
import { ServicesProvider } from './services';
import { SessionProvider } from './session';
import { SettingsProvider, useSettings, type Settings } from './settings';
import { ToastProvider, useToast } from './toast';

function Entry() {
  const { settings } = useSettings();
  if (!settings.onboardingDone) return <Navigate to="/boas-vindas" replace />;
  if (!settings.authSeen) return <Navigate to="/entrar" replace />;
  return <Navigate to="/inicio" replace />;
}

/** Avisa quando há versão nova do service worker (atualização sob demanda). */
function UpdatePrompt() {
  const { t } = useI18n();
  const toast = useToast();
  const {
    needRefresh: [needRefresh],
    offlineReady: [offlineReady],
    updateServiceWorker,
  } = useRegisterSW();
  useEffect(() => {
    if (needRefresh) toast(t('update.available'), { sticky: true, action: { label: t('update.reload'), onClick: () => updateServiceWorker(true) } });
  }, [needRefresh, t, toast, updateServiceWorker]);
  useEffect(() => {
    if (offlineReady) toast(t('update.offlineReady'));
  }, [offlineReady, t, toast]);
  return null;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route index element={<Entry />} />
      <Route element={<Layout bare />}>
        <Route path="/boas-vindas" element={<WelcomePage />} />
        <Route path="/entrar" element={<AuthPage />} />
        <Route path="/processando" element={<ProcessingPage />} />
      </Route>
      <Route element={<Layout />}>
        <Route path="/inicio" element={<HomePage />} />
        <Route path="/analisar" element={<CapturePage />} />
        <Route path="/resultado" element={<ResultPage />} />
        <Route path="/historico" element={<HistoryPage />} />
        <Route path="/historico/:id" element={<HistoryDetailPage />} />
        <Route path="/saiba-mais" element={<LearnPage />} />
        <Route path="/perfil" element={<ProfilePage />} />
        <Route path="/suporte" element={<SupportPage />} />
        <Route path="/instalar" element={<InstallPage />} />
        {flags.FEATURE_GEOLOCATION && <Route path="/localizacao" element={<LocationConsentPage />} />}
        {flags.FEATURE_HEATMAP && <Route path="/mapa" element={<HeatmapPage />} />}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

/** Provedores compartilhados pelo app e pelos testes. */
export function AppProviders({ children, services, settings }: { children: ReactNode; services?: Services; settings?: Partial<Settings> }) {
  return (
    <SettingsProvider initial={settings}>
      <LocalizedProviders services={services}>{children}</LocalizedProviders>
    </SettingsProvider>
  );
}

function LocalizedProviders({ children, services }: { children: ReactNode; services?: Services }) {
  const { settings } = useSettings();
  return (
    <I18nProvider locale={settings.locale}>
      <ServicesProvider value={services}>
        <AuthProvider>
          <SessionProvider>
            <ToastProvider>{children}</ToastProvider>
          </SessionProvider>
        </AuthProvider>
      </ServicesProvider>
    </I18nProvider>
  );
}

export function App() {
  return (
    <AppProviders>
      <BrowserRouter>
        <UpdatePrompt />
        <HistorySyncPrompt />
        <AppRoutes />
      </BrowserRouter>
    </AppProviders>
  );
}
