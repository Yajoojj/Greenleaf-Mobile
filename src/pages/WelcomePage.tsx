import { Camera, ScanSearch, ShieldCheck, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../app/settings';
import { useI18n } from '../i18n';
import { Button } from '../ui';
import { usePageTitle } from './parts/usePageTitle';

const CARDS: { icon: LucideIcon; key: '1' | '2' | '3' }[] = [
  { icon: ScanSearch, key: '1' },
  { icon: Camera, key: '2' },
  { icon: ShieldCheck, key: '3' },
];

/** Boas-vindas: 3 cartões — o que o app faz, como fotografar, resultado é estimativa. */
export function WelcomePage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { settings, update } = useSettings();
  const [index, setIndex] = useState(0);
  usePageTitle(t('app.tagline'));

  const finish = () => {
    update({ onboardingDone: true });
    navigate(settings.authSeen ? '/inicio' : '/entrar', { replace: true });
  };

  const card = CARDS[index];
  const Icon = card.icon;
  const last = index === CARDS.length - 1;

  return (
    <>
      <div className="gl-row" style={{ justifyContent: 'space-between' }}>
        <p className="gl-small gl-muted" aria-live="polite">{t('welcome.step', { n: index + 1, total: CARDS.length })}</p>
        <Button variant="ghost" onClick={finish}>{t('welcome.skip')}</Button>
      </div>

      <section className="gl-onboarding-card" aria-labelledby="welcome-title">
        <div className="gl-onboarding-card__art">
          <Icon size={52} strokeWidth={1.75} aria-hidden="true" />
        </div>
        <h1 id="welcome-title">{t(`welcome.${card.key}.title`)}</h1>
        <p>{t(`welcome.${card.key}.body`)}</p>
      </section>

      <div className="gl-dots">
        {CARDS.map((c, i) => (
          <button
            key={c.key}
            type="button"
            aria-label={t('welcome.goTo', { n: i + 1 })}
            aria-current={i === index ? 'step' : undefined}
            onClick={() => setIndex(i)}
          >
            <span />
          </button>
        ))}
      </div>

      <div className="gl-action-bar gl-push-down">
        <Button size="lg" block onClick={last ? finish : () => setIndex(index + 1)}>
          {last ? t('welcome.start') : t('welcome.next')}
        </Button>
      </div>
    </>
  );
}
