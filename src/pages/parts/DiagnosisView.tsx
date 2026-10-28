import { ChevronDown, Info, ListChecks, ShieldAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { Diagnosis } from '../../domain/Diagnosis';
import type { Analysis } from '../../domain/types';
import { useI18n, type MessageKey } from '../../i18n';
import { DiagnosisBadge, ImageCompare, SeverityScale } from '../../ui';

const TODO_COUNT = { sadia: 3, leve: 4, moderada: 4, grave: 4 } as const;

/**
 * Figma: DiagnosisCard — estado, chance, área com manchas, imagem com overlay,
 * explicação, o que fazer e aviso de responsabilidade. Usado no resultado e no histórico.
 */
export function DiagnosisView({
  analysis,
  badges,
  primaryAction,
  secondaryActions,
}: {
  analysis: Analysis;
  badges?: ReactNode;
  /** Ação principal, fixa na parte de baixo da tela (alcance do polegar). */
  primaryAction?: ReactNode;
  /** Demais ações, no fim do conteúdo, para não cobrir o diagnóstico. */
  secondaryActions?: ReactNode;
}) {
  const { t, formatNumber, formatDate } = useI18n();
  const d = Diagnosis.fromAnalysis(analysis);
  const s = d.state;

  return (
    <>
      <section className={`gl-diagnosis-head gl-tone--${s}`} aria-labelledby="dx-title">
        <div className="gl-row" style={{ justifyContent: 'space-between' }}>
          <h1 id="dx-title" className="visually-hidden">{t('result.title')}</h1>
          <DiagnosisBadge state={s} size="lg" />
          {badges}
        </div>
        <p className="gl-diagnosis-head__summary">{t(`result.summary.${s}`)}</p>
        <SeverityScale state={s} />
      </section>

      <section className="gl-stack gl-stack--sm" aria-label={t('result.chance')}>
        <div className="gl-metrics">
          <div className="gl-metric">
            <p className="gl-metric__value">{d.probabilityPercent}%</p>
            <p className="gl-metric__label">{t('result.chance')}</p>
          </div>
          <div className="gl-metric">
            <p className="gl-metric__value">{formatNumber(d.ratioPercent, 1)}%</p>
            <p className="gl-metric__label">{t('result.area')}</p>
          </div>
        </div>
        <p className="gl-small gl-muted">{t('common.estimate')}</p>
        {d.colorOnly && (
          <p className="gl-small gl-row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
            <Info size={18} aria-hidden="true" style={{ flex: 'none', marginTop: 3 }} color="var(--text-muted)" />
            <span>
              <strong>{t('result.colorOnly')}</strong>
            </span>
          </p>
        )}
      </section>

      <ImageCompare original={analysis.imageDataUrl} overlay={analysis.overlayDataUrl} />

      <section className="gl-card" aria-labelledby="dx-meaning">
        <h2 id="dx-meaning" className="gl-card__title">
          <Info size={22} aria-hidden="true" color="var(--color-green-700)" /> {t('result.meaning')}
        </h2>
        <p>{t(`result.meaning.${s}`)}</p>
        {d.colorOnly && <p className="gl-small gl-muted">{t('result.colorOnlyMore')}</p>}
      </section>

      <section className="gl-card" aria-labelledby="dx-todo">
        <h2 id="dx-todo" className="gl-card__title">
          <ListChecks size={22} aria-hidden="true" color="var(--color-green-700)" /> {t('result.todo')}
        </h2>
        <ul className="gl-tips">
          {Array.from({ length: TODO_COUNT[s] }, (_, i) => (
            <li key={i}>
              <span aria-hidden="true" style={{ fontWeight: 700, color: 'var(--color-green-800)', minWidth: 18 }}>{i + 1}.</span>
              {t(`result.todo.${s}.${i + 1}` as MessageKey)}
            </li>
          ))}
        </ul>
        <p className="gl-small gl-muted">{t('result.todo.note')}</p>
      </section>

      <p className="gl-disclaimer">
        <ShieldAlert size={22} aria-hidden="true" style={{ flex: 'none' }} color="var(--color-neutral-700)" />
        <span>{t('result.disclaimer')}</span>
      </p>

      <details className="gl-accordion">
        <summary>
          {t('result.details')}
          <ChevronDown className="gl-accordion__chev" size={20} aria-hidden="true" />
        </summary>
        <div className="gl-accordion__content">
          <dl className="gl-kv">
            <dt>{t('result.details.model')}</dt>
            <dd>{analysis.modelProbability === null ? t('result.details.na') : `${Math.round(analysis.modelProbability * 100)}%`}</dd>
            <dt>{t('result.details.hsv')}</dt>
            <dd>{Math.round(analysis.hsvProbability * 100)}%</dd>
            <dt>{t('result.details.time')}</dt>
            <dd>{analysis.processingTimeMs} ms</dd>
            <dt>{t('result.details.date')}</dt>
            <dd>{formatDate(analysis.createdAt)}</dd>
          </dl>
        </div>
      </details>

      {secondaryActions && <div className="gl-button-row">{secondaryActions}</div>}
      {primaryAction && <div className="gl-action-bar">{primaryAction}</div>}
    </>
  );
}
