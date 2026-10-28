import { Bug, Camera, ChevronDown, CircleHelp, Cpu, TriangleAlert, type LucideIcon } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useI18n, type MessageKey } from '../i18n';
import { usePageTitle } from './parts/usePageTitle';

function Section({ id, icon: Icon, title, children, open }: { id: string; icon: LucideIcon; title: string; children: ReactNode; open?: boolean }) {
  return (
    <details className="gl-accordion" id={id} open={open}>
      <summary>
        <Icon size={24} aria-hidden="true" />
        <span>{title}</span>
        <ChevronDown className="gl-accordion__chev" size={20} aria-hidden="true" />
      </summary>
      <div className="gl-accordion__content">{children}</div>
    </details>
  );
}

function Technical({ children }: { children: ReactNode }) {
  return <p className="gl-small gl-muted" style={{ borderLeft: '3px solid var(--border-default)', paddingLeft: 12 }}>{children}</p>;
}

export function LearnPage() {
  const { t } = useI18n();
  const { hash } = useLocation();
  usePageTitle(t('learn.title'));
  const list = (prefix: string, n: number) => (
    <ul>
      {Array.from({ length: n }, (_, i) => <li key={i}>{t(`${prefix}.${i + 1}` as MessageKey)}</li>)}
    </ul>
  );

  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' });
  }, [hash]);

  return (
    <>
      <div className="gl-page-title">
        <h1>{t('learn.title')}</h1>
        <p>{t('learn.subtitle')}</p>
      </div>
      <div>
        <Section id="doenca" icon={Bug} title={t('learn.disease.title')} open={!hash || hash === '#doenca'}>
          <p>{t('learn.disease.1')}</p>
          <p>{t('learn.disease.2')}</p>
          <p>{t('learn.disease.3')}</p>
          <Technical><em>{t('learn.disease.technical')}</em></Technical>
        </Section>
        <Section id="foto" icon={Camera} title={t('learn.photo.title')} open={hash === '#foto'}>
          {list('learn.photo', 5)}
        </Section>
        <Section id="como-funciona" icon={Cpu} title={t('learn.how.title')} open={hash === '#como-funciona'}>
          <p>{t('learn.how.1')}</p>
          <p>{t('learn.how.2')}</p>
          <p>{t('learn.how.3')}</p>
          <p>{t('learn.how.4')}</p>
          <Technical>{t('learn.how.technical')}</Technical>
        </Section>
        <Section id="limitacoes" icon={TriangleAlert} title={t('learn.limits.title')} open={hash === '#limitacoes'}>
          {list('learn.limits', 5)}
        </Section>
        <Section id="duvidas" icon={CircleHelp} title={t('learn.faq.title')} open={hash === '#duvidas'}>
          {([1, 2, 3] as const).map((n) => (
            <div key={n} className="gl-stack gl-stack--sm">
              <h3 style={{ fontSize: 'var(--font-size-md)' }}>{t(`learn.faq.q${n}`)}</h3>
              <p>{t(`learn.faq.a${n}`)}</p>
            </div>
          ))}
        </Section>
      </div>
    </>
  );
}
