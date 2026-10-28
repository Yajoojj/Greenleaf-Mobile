import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../../i18n';

export function BackLink({ to }: { to?: string }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  return (
    <button
      type="button"
      className="gl-button gl-button--ghost"
      style={{ alignSelf: 'flex-start', marginLeft: -12 }}
      onClick={() => (to ? navigate(to) : window.history.length > 1 ? navigate(-1) : navigate('/inicio'))}
    >
      <ArrowLeft size={20} aria-hidden="true" />
      <span>{t('nav.back')}</span>
    </button>
  );
}
