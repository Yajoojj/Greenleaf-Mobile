import { Download, Monitor, Smartphone } from 'lucide-react';
import { useInstallPrompt } from '../app/hooks';
import { useI18n } from '../i18n';
import { Button, StatusMessage } from '../ui';
import { BackLink } from './parts/BackLink';
import { usePageTitle } from './parts/usePageTitle';

export function InstallPage() {
  const { t } = useI18n();
  const { canInstall, installed, install } = useInstallPrompt();
  usePageTitle(t('install.title'));

  return (
    <>
      <BackLink />
      <div className="gl-page-title">
        <h1>{t('install.title')}</h1>
        <p>{t('install.subtitle')}</p>
      </div>
      {installed ? (
        <StatusMessage tone="success">{t('install.done')}</StatusMessage>
      ) : (
        <>
          {canInstall && (
            <Button size="lg" block icon={<Download size={24} aria-hidden="true" />} onClick={install}>
              {t('install.button')}
            </Button>
          )}
          <section className="gl-card">
            <h2 className="gl-card__title"><Smartphone size={22} aria-hidden="true" color="var(--color-green-700)" /> {t('install.android')}</h2>
            <ol style={{ margin: 0, paddingLeft: '1.3em' }}>
              <li>{t('install.android.1')}</li>
              <li>{t('install.android.2')}</li>
            </ol>
          </section>
          <section className="gl-card">
            <h2 className="gl-card__title"><Smartphone size={22} aria-hidden="true" color="var(--color-green-700)" /> {t('install.ios')}</h2>
            <ol style={{ margin: 0, paddingLeft: '1.3em' }}>
              <li>{t('install.ios.1')}</li>
              <li>{t('install.ios.2')}</li>
            </ol>
          </section>
          <section className="gl-card">
            <h2 className="gl-card__title"><Monitor size={22} aria-hidden="true" color="var(--color-green-700)" /> {t('install.desktop')}</h2>
            <p>{t('install.desktop.1')}</p>
          </section>
        </>
      )}
    </>
  );
}
