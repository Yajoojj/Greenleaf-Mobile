import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { Services } from '../domain/services';
import { ServiceFactory } from '../config/ServiceFactory';
import { useSettings } from './settings';

const ServicesContext = createContext<Services | null>(null);

/** Entrega os serviços às telas; em testes, passe `value` com dublês. */
export function ServicesProvider({ children, value }: { children: ReactNode; value?: Services }) {
  const { settings } = useSettings();
  const services = useMemo(() => value ?? ServiceFactory.create({ demoMode: settings.demoMode }), [value, settings.demoMode]);
  return <ServicesContext.Provider value={services}>{children}</ServicesContext.Provider>;
}

export function useServices(): Services {
  const ctx = useContext(ServicesContext);
  if (!ctx) throw new Error('useServices fora do ServicesProvider');
  return ctx;
}
