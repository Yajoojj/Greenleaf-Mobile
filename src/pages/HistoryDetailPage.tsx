import { Share2, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useServices } from '../app/services';
import { useToast } from '../app/toast';
import type { Analysis } from '../domain/types';
import { useI18n } from '../i18n';
import { Button, ButtonLink, ConfirmDialog, LoadingState, StatusMessage } from '../ui';
import { BackLink } from './parts/BackLink';
import { DiagnosisView } from './parts/DiagnosisView';
import { shareAnalysis } from './parts/share';
import { usePageTitle } from './parts/usePageTitle';

export function HistoryDetailPage() {
  const { t } = useI18n();
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { analyses } = useServices();
  const toast = useToast();
  const [analysis, setAnalysis] = useState<Analysis | null | undefined>(undefined);
  const [confirming, setConfirming] = useState(false);
  usePageTitle(t('result.title'));

  useEffect(() => {
    let alive = true;
    analyses.get(id).then(
      (a) => alive && setAnalysis(a),
      () => alive && setAnalysis(null),
    );
    return () => {
      alive = false;
    };
  }, [analyses, id]);

  if (analysis === undefined) return <LoadingState label={t('common.loading')} />;
  if (analysis === null) {
    return (
      <>
        <BackLink to="/historico" />
        <h1 className="visually-hidden">{t('result.title')}</h1>
        <StatusMessage centered tone="warning" title={t('result.notFound')} actions={<ButtonLink to="/historico">{t('nav.history')}</ButtonLink>} />
      </>
    );
  }

  const remove = async () => {
    setConfirming(false);
    await analyses.remove(analysis.id);
    toast(t('result.deleted'));
    navigate('/historico', { replace: true });
  };

  return (
    <>
      <BackLink to="/historico" />
      <DiagnosisView
        analysis={analysis}
        badges={analysis.source === 'demo' ? <span className="gl-badge gl-badge--demo">{t('badge.demo')}</span> : null}
        secondaryActions={
          <>
            <Button
              variant="secondary"
              icon={<Share2 size={20} aria-hidden="true" />}
              onClick={async () => {
                const r = await shareAnalysis(analysis, t);
                if (r === 'copied') toast(t('result.copied'));
                if (r === 'failed') toast(t('result.shareFail'));
              }}
            >
              {t('result.share')}
            </Button>
            <Button variant="danger" icon={<Trash2 size={20} aria-hidden="true" />} onClick={() => setConfirming(true)}>
              {t('common.delete')}
            </Button>
          </>
        }
      />
      <ConfirmDialog
        open={confirming}
        message={t('result.deleteConfirm')}
        confirmLabel={t('result.delete')}
        danger
        onConfirm={remove}
        onCancel={() => setConfirming(false)}
      />
    </>
  );
}
