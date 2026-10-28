import { Camera, ChevronRight, Download, History, Lightbulb } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../app/auth';
import { useInstallPrompt, useServerStatus } from '../app/hooks';
import { useServices } from '../app/services';
import { useSettings } from '../app/settings';
import type { Analysis } from '../domain/types';
import { useI18n } from '../i18n';
import { ButtonLink, CassavaLeafOutline, HistoryItem, ServerStatusPill, StatusMessage } from '../ui';
import { usePageTitle } from './parts/usePageTitle';

export function HomePage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { settings } = useSettings();
  const services = useServices();
  const server = useServerStatus();
  const { installed } = useInstallPrompt();
  const [last, setLast] = useState<Analysis | null | undefined>(undefined);
  usePageTitle(t('nav.home'));

  useEffect(() => {
    let alive = true;
    services.analyses.list().then(
      (rows) => alive && setLast(rows[0] ?? null),
      () => alive && setLast(null),
    );
    return () => {
      alive = false;
    };
  }, [services.analyses]);

  const firstName = user?.name.split(' ')[0];

  return (
    <>
      <section className="gl-hero" aria-labelledby="home-title">
        <CassavaLeafOutline className="gl-hero__art" stroke="#fff" strokeWidth={2} />
        <h1 id="home-title">{firstName ? t('home.hello', { name: firstName }) : t('home.helloGuest')}</h1>
        <p>{t('home.lead')}</p>
        <div>
          <ServerStatusPill state={server} mode={services.predictionMode} />
        </div>
      </section>

      <section className="gl-stack" aria-labelledby="home-last">
        <div className="gl-row">
          <h2 id="home-last" className="gl-grow">{t('home.last')}</h2>
          <Link to="/historico" className="gl-button gl-button--ghost">
            <History size={20} aria-hidden="true" />
            <span>{t('home.seeHistory')}</span>
          </Link>
        </div>
        {last === undefined ? (
          <div className="gl-history-item" aria-busy="true"><span className="gl-muted">{t('common.loading')}</span></div>
        ) : last ? (
          <HistoryItem analysis={last} />
        ) : (
          <StatusMessage>{t('home.noLast')}</StatusMessage>
        )}
      </section>

      <section className="gl-card gl-card--flat" aria-labelledby="home-tip">
        <p className="gl-card__title" id="home-tip">
          <Lightbulb size={22} color="var(--color-amber-700)" aria-hidden="true" /> {t('home.tipTitle')}
        </p>
        <p>{t('home.tip')}</p>
        <Link to="/saiba-mais#foto" className="gl-row" style={{ fontWeight: 600, minHeight: 44 }}>
          {t('home.learnLink')} <ChevronRight size={18} aria-hidden="true" />
        </Link>
      </section>

      {!installed && (
        <Link to="/instalar" className="gl-menu__item gl-card gl-card--link" style={{ flexDirection: 'row' }}>
          <Download size={22} aria-hidden="true" color="var(--color-green-700)" />
          {t('home.install')}
          <ChevronRight className="gl-menu__end" size={20} aria-hidden="true" />
        </Link>
      )}

      <div className="gl-action-bar gl-push-down">
        <ButtonLink to="/analisar" size="lg" block icon={<Camera size={26} aria-hidden="true" />}>
          {settings.demoMode ? t('home.analyzeDemo') : t('home.analyze')}
        </ButtonLink>
      </div>
    </>
  );
}
