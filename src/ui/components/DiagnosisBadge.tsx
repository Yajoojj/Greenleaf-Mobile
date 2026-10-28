import { CircleAlert, CircleCheck, OctagonAlert, TriangleAlert, type LucideIcon } from 'lucide-react';
import type { DiagnosisState } from '../../domain/types';
import { useI18n } from '../../i18n';

/** Cada estado tem forma de ícone diferente: a cor nunca é o único indicador. */
export const DIAGNOSIS_ICON: Record<DiagnosisState, LucideIcon> = {
  sadia: CircleCheck,
  leve: CircleAlert,
  moderada: TriangleAlert,
  grave: OctagonAlert,
};

/** Figma: DiagnosisBadge / {Sadia|Leve|Moderada|Grave} / {Small|Large} */
export function DiagnosisBadge({ state, size = 'sm' }: { state: DiagnosisState; size?: 'sm' | 'lg' }) {
  const { t } = useI18n();
  const Icon = DIAGNOSIS_ICON[state];
  return (
    <span className={`gl-diagnosis-badge gl-tone--${state}${size === 'lg' ? ' gl-diagnosis-badge--lg' : ''}`}>
      <Icon aria-hidden="true" size={size === 'lg' ? 30 : 20} strokeWidth={2.5} />
      <span>{t(`state.${state}`)}</span>
    </span>
  );
}

/** Figma: SeverityScale — os 4 degraus, com o atual destacado. */
export function SeverityScale({ state }: { state: DiagnosisState }) {
  const { t } = useI18n();
  const states: DiagnosisState[] = ['sadia', 'leve', 'moderada', 'grave'];
  const current = states.indexOf(state);
  const fills = ['var(--color-green-500)', 'var(--color-amber-500)', 'var(--color-orange-500)', 'var(--color-red-500)'];
  return (
    <div className="gl-stack gl-stack--sm" role="group" aria-label={t('result.scale')}>
      <div className="gl-severity-scale" aria-hidden="true">
        {states.map((s, i) => (
          <span key={s} className="gl-severity-scale__step" style={{ background: i <= current ? fills[current] : undefined }} />
        ))}
      </div>
      <div className="gl-severity-scale__labels">
        {states.map((s) => (
          <span key={s} aria-current={s === state ? 'true' : undefined}>{t(`state.${s}`)}</span>
        ))}
      </div>
    </div>
  );
}
