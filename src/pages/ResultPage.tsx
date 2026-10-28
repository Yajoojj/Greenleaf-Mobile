import { Camera, Check, Save, Share2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useServices } from '../app/services';
import { useSession } from '../app/session';
import { useToast } from '../app/toast';
import { useI18n } from '../i18n';
import { Button, ButtonLink, StatusMessage } from '../ui';
import { DiagnosisView } from './parts/DiagnosisView';
import { shareAnalysis } from './parts/share';
import { usePageTitle } from './parts/usePageTitle';

export function ResultPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const services = useServices();
  const toast = useToast();
  const { result, resultSaved, markSaved, clearCapture, setResult } = useSession();
  const [saving, setSaving] = useState(false);
  usePageTitle(t('result.title'));

  if (!result) {
    return (
      <StatusMessage centered title={t('result.empty')} actions={<ButtonLink to="/analisar">{t('home.analyze')}</ButtonLink>} />
    );
  }

  const save = async () => {
    setSaving(true);
    try {
      await services.analyses.save(result);
      markSaved();
      toast(t('result.saved'));
    } catch {
      toast(t('result.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const share = async () => {
    const outcome = await shareAnalysis(result, t);
    if (outcome === 'copied') toast(t('result.copied'));
    if (outcome === 'failed') toast(t('result.shareFail'));
  };

  const again = () => {
    clearCapture();
    setResult(null);
    navigate('/analisar');
  };

  const badges = result.source === 'demo'
    ? <span className="gl-badge gl-badge--demo">{t('badge.demo')}</span>
    : result.simulated
      ? <span className="gl-badge gl-badge--info">{t('badge.simulated')}</span>
      : null;

  return (
    <DiagnosisView
      analysis={result}
      badges={badges}
      primaryAction={
        <Button
          size="lg"
          block
          onClick={save}
          loading={saving}
          loadingLabel={t('result.saving')}
          disabled={resultSaved}
          icon={resultSaved ? <Check size={24} aria-hidden="true" /> : <Save size={24} aria-hidden="true" />}
        >
          {resultSaved ? t('result.saved') : t('result.save')}
        </Button>
      }
      secondaryActions={
        <>
          <Button variant="secondary" icon={<Camera size={20} aria-hidden="true" />} onClick={again}>
            {t('result.new')}
          </Button>
          <Button variant="secondary" icon={<Share2 size={20} aria-hidden="true" />} onClick={share}>
            {t('result.share')}
          </Button>
        </>
      }
    />
  );
}
