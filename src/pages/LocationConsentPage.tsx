import { MapPin, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useServices } from '../app/services';
import { useSettings } from '../app/settings';
import { useToast } from '../app/toast';
import { useI18n } from '../i18n';
import { Button } from '../ui';
import { BackLink } from './parts/BackLink';
import { usePageTitle } from './parts/usePageTitle';

/** [Futuro — FEATURE_GEOLOCATION] Consentimento explícito; recusar não perde nenhuma função. */
export function LocationConsentPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const toast = useToast();
  const { location } = useServices();
  const { update } = useSettings();
  const [granted, setGranted] = useState(false);
  const [busy, setBusy] = useState(false);
  usePageTitle(t('location.title'));

  useEffect(() => {
    location.consentStatus().then(setGranted, () => setGranted(false));
  }, [location]);

  const allow = async () => {
    setBusy(true);
    const ok = await location.requestConsent().catch(() => false);
    setBusy(false);
    update({ locationAsked: true });
    toast(ok ? t('location.granted') : t('location.denied'));
    navigate(-1);
  };

  const deny = async () => {
    await location.revokeConsent().catch(() => undefined);
    update({ locationAsked: true });
    toast(t('location.denied'));
    navigate(-1);
  };

  return (
    <>
      <BackLink />
      <div className="gl-onboarding-card__art"><MapPin size={52} strokeWidth={1.75} aria-hidden="true" /></div>
      <div className="gl-page-title">
        <h1>{t('location.title')}</h1>
        <p>{t('location.body')}</p>
      </div>
      <ul className="gl-tips gl-card">
        <li><ShieldCheck size={18} aria-hidden="true" />{t('location.what')}</li>
        <li><ShieldCheck size={18} aria-hidden="true" />{t('location.optional')}</li>
        <li><ShieldCheck size={18} aria-hidden="true" />{t('location.revoke')}</li>
      </ul>
      <div className="gl-action-bar gl-push-down">
        {!granted && (
          <Button size="lg" block loading={busy} icon={<MapPin size={22} aria-hidden="true" />} onClick={allow}>
            {t('location.allow')}
          </Button>
        )}
        <Button variant="secondary" block onClick={deny}>{granted ? t('location.stop') : t('location.deny')}</Button>
      </div>
    </>
  );
}
