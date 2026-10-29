import { ChevronRight, Download, LifeBuoy, LogIn, LogOut, Map, MapPin, ShieldCheck, Trash2, UserRound, UserRoundX } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../app/auth';
import { useServerStatus } from '../app/hooks';
import { useServices } from '../app/services';
import { useSettings } from '../app/settings';
import { useToast } from '../app/toast';
import { env, flags } from '../config/env';
import { useI18n, type Locale } from '../i18n';
import { Button, ConfirmDialog, SegmentedControl, ServerStatusPill, Switch } from '../ui';
import { usePageTitle } from './parts/usePageTitle';

const TEAM = [
  'Carlos Eduardo Campos Takeshita',
  'Filipe de Oliveira Lima',
  'Yago Uran Kurashiki Rios',
];

type Confirm = 'clear' | 'deleteAccount' | null;

export function ProfilePage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const toast = useToast();
  const services = useServices();
  const server = useServerStatus();
  const { settings, update } = useSettings();
  const { user, signOut, deleteAccount } = useAuth();
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [locationOn, setLocationOn] = useState(false);
  usePageTitle(t('profile.title'));

  useEffect(() => {
    services.location.consentStatus().then(setLocationOn, () => setLocationOn(false));
  }, [services.location]);

  const clearAll = async () => {
    setConfirm(null);
    await services.analyses.clear().catch(() => undefined);
    await signOut().catch(() => undefined);
    await services.location.revokeConsent().catch(() => undefined);
    try {
      Object.keys(localStorage).filter((k) => k.startsWith('gl.')).forEach((k) => localStorage.removeItem(k));
    } catch {
      /* armazenamento indisponível */
    }
    toast(t('profile.cleared'));
    update({ demoMode: false, onboardingDone: false, authSeen: false, locationAsked: false });
    navigate('/boas-vindas', { replace: true });
  };

  const removeAccount = async () => {
    setConfirm(null);
    await deleteAccount().catch(() => undefined);
    toast(t('profile.accountDeleted'));
  };

  const modeKey = `profile.server.mode.${services.predictionMode}` as const;

  return (
    <>
      <h1>{t('profile.title')}</h1>

      <section className="gl-stack gl-stack--sm" aria-labelledby="p-account">
        <h2 id="p-account">{t('profile.account')}</h2>
        <div className="gl-card">
          <p className="gl-card__title">
            {user ? <UserRound size={24} aria-hidden="true" color="var(--color-green-700)" /> : <UserRoundX size={24} aria-hidden="true" color="var(--text-muted)" />}
            {user ? user.name : t('profile.guest')}
          </p>
          <p className="gl-muted">{user ? user.email : t('profile.guestBody')}</p>
          {user ? (
            <div className="gl-row">
              <Button variant="secondary" icon={<LogOut size={20} aria-hidden="true" />} onClick={() => signOut()}>
                {t('profile.signOut')}
              </Button>
              <Button variant="ghost" onClick={() => setConfirm('deleteAccount')}>{t('profile.deleteAccount')}</Button>
            </div>
          ) : (
            <Link to="/entrar" className="gl-button gl-button--secondary" style={{ alignSelf: 'flex-start' }}>
              <LogIn size={20} aria-hidden="true" />
              <span>{t('profile.signIn')}</span>
            </Link>
          )}
        </div>
      </section>

      <section className="gl-stack gl-stack--sm" aria-labelledby="p-lang">
        <h2 id="p-lang">{t('profile.language')}</h2>
        <SegmentedControl<Locale>
          label={t('profile.language')}
          value={settings.locale}
          onChange={(locale) => update({ locale })}
          options={[
            { value: 'pt-BR', label: 'Português' },
            { value: 'en', label: 'English' },
          ]}
        />
      </section>

      <section className="gl-stack gl-stack--sm" aria-labelledby="p-demo">
        <h2 id="p-demo" className="visually-hidden">{t('profile.demo')}</h2>
        <div className="gl-card" style={{ padding: 0 }}>
          <Switch label={t('profile.demo')} description={t('profile.demoBody')} checked={settings.demoMode} onChange={(demoMode) => update({ demoMode })} />
        </div>
      </section>

      <section className="gl-stack gl-stack--sm" aria-labelledby="p-server">
        <h2 id="p-server">{t('profile.server')}</h2>
        <div className="gl-card">
          <ServerStatusPill state={server} mode={services.predictionMode} />
          <dl className="gl-kv">
            <dt>{t('profile.server.mode')}</dt>
            <dd>{t(modeKey)}</dd>
            {services.predictionMode === 'api' && server.kind === 'ok' && (
              <>
                <dt>{t('profile.server.model')}</dt>
                <dd>{server.health.model_loaded ? t('common.yes') : t('common.no')}</dd>
                <dt>{t('profile.server.version')}</dt>
                <dd>{server.health.version}</dd>
              </>
            )}
          </dl>
        </div>
      </section>

      <section className="gl-stack gl-stack--sm" aria-labelledby="p-privacy">
        <h2 id="p-privacy">{t('profile.privacy')}</h2>
        <div className="gl-card">
          <ul className="gl-tips">
            {([1, 2, 3, 4] as const).map((n) => (
              <li key={n}><ShieldCheck size={18} aria-hidden="true" />{t(`profile.privacy.${n}`)}</li>
            ))}
          </ul>
          <Button variant="danger" icon={<Trash2 size={20} aria-hidden="true" />} onClick={() => setConfirm('clear')} style={{ alignSelf: 'flex-start' }}>
            {t('profile.clearData')}
          </Button>
        </div>
      </section>

      <section className="gl-stack gl-stack--sm" aria-labelledby="p-more">
        <h2 id="p-more">{t('profile.more')}</h2>
        <ul className="gl-menu">
          {flags.FEATURE_GEOLOCATION && (
            <li>
              <Link to="/localizacao" className="gl-menu__item">
                <MapPin size={22} aria-hidden="true" />
                {t('profile.location')}
                <span className="gl-menu__end">{locationOn ? t('profile.locationOn') : t('profile.locationOff')}<ChevronRight size={18} aria-hidden="true" /></span>
              </Link>
            </li>
          )}
          {flags.FEATURE_HEATMAP && (
            <li>
              <Link to="/mapa" className="gl-menu__item">
                <Map size={22} aria-hidden="true" />
                {t('profile.heatmap')}
                <span className="gl-menu__end"><span className="gl-badge gl-badge--soon">{t('badge.soon')}</span><ChevronRight size={18} aria-hidden="true" /></span>
              </Link>
            </li>
          )}
          <li>
            <Link to="/suporte" className="gl-menu__item">
              <LifeBuoy size={22} aria-hidden="true" />
              {t('profile.support')}
              <ChevronRight className="gl-menu__end" size={18} aria-hidden="true" />
            </Link>
          </li>
          <li>
            <Link to="/instalar" className="gl-menu__item">
              <Download size={22} aria-hidden="true" />
              {t('profile.install')}
              <ChevronRight className="gl-menu__end" size={18} aria-hidden="true" />
            </Link>
          </li>
        </ul>
      </section>

      <section className="gl-stack gl-stack--sm" aria-labelledby="p-about">
        <h2 id="p-about">{t('profile.about')}</h2>
        <div className="gl-card">
          <p>{t('profile.about.body')}</p>
          <h3 style={{ fontSize: 'var(--font-size-md)' }}>{t('profile.about.team')}</h3>
          <ul style={{ margin: 0, paddingLeft: '1.2em' }}>
            {TEAM.map((n) => <li key={n}>{n}</li>)}
          </ul>
          <p className="gl-small gl-muted">{t('profile.about.version', { v: env.version })}</p>
        </div>
      </section>

      <ConfirmDialog
        open={confirm === 'clear'}
        message={t('profile.clearDataConfirm')}
        confirmLabel={t('profile.clearData')}
        danger
        onConfirm={clearAll}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === 'deleteAccount'}
        message={t('profile.deleteAccountConfirm')}
        confirmLabel={t('profile.deleteAccount')}
        danger
        onConfirm={removeAccount}
        onCancel={() => setConfirm(null)}
      />
    </>
  );
}
