import { Camera } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useServices } from '../app/services';
import { DIAGNOSIS_STATES, type Analysis, type DiagnosisState } from '../domain/types';
import { useI18n } from '../i18n';
import { ButtonLink, DIAGNOSIS_ICON, HistoryItem, LoadingState, StatusMessage } from '../ui';
import { usePageTitle } from './parts/usePageTitle';

type Filter = DiagnosisState | 'all';

export function HistoryPage() {
  const { t } = useI18n();
  const { analyses } = useServices();
  const [filter, setFilter] = useState<Filter>('all');
  const [rows, setRows] = useState<Analysis[] | null>(null);
  const [failed, setFailed] = useState(false);
  usePageTitle(t('history.title'));

  useEffect(() => {
    let alive = true;
    setRows(null);
    setFailed(false);
    analyses.list(filter === 'all' ? undefined : { state: filter }).then(
      (r) => alive && setRows(r),
      () => alive && setFailed(true),
    );
    return () => {
      alive = false;
    };
  }, [analyses, filter]);

  return (
    <>
      <div className="gl-page-title">
        <h1>{t('history.title')}</h1>
        <p>{t('history.subtitle')}</p>
      </div>

      <div className="gl-chips" role="group" aria-label={t('history.filter')}>
        {(['all', ...DIAGNOSIS_STATES] as Filter[]).map((f) => {
          const Icon = f === 'all' ? null : DIAGNOSIS_ICON[f];
          return (
            <button key={f} type="button" className="gl-chip" aria-pressed={filter === f} onClick={() => setFilter(f)}>
              {Icon && <Icon size={18} aria-hidden="true" />}
              {f === 'all' ? t('state.all') : t(`state.${f}`)}
            </button>
          );
        })}
      </div>

      {failed ? (
        <StatusMessage tone="error" role="alert">{t('history.loadError')}</StatusMessage>
      ) : rows === null ? (
        <LoadingState label={t('common.loading')} />
      ) : rows.length === 0 ? (
        filter === 'all' ? (
          <StatusMessage
            centered
            title={t('history.empty')}
            actions={<ButtonLink to="/analisar" icon={<Camera size={20} aria-hidden="true" />}>{t('home.analyze')}</ButtonLink>}
          >
            {t('history.emptyBody')}
          </StatusMessage>
        ) : (
          <StatusMessage centered>{t('history.emptyFiltered')}</StatusMessage>
        )
      ) : (
        <>
          <p className="gl-small gl-muted" aria-live="polite">
            {rows.length === 1 ? t('history.countOne') : t('history.count', { n: rows.length })}
          </p>
          <ul className="gl-list">
            {rows.map((a) => (
              <li key={a.id}>
                <HistoryItem analysis={a} />
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
