import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Analysis } from '../../domain/types';
import { useI18n } from '../../i18n';
import { DiagnosisBadge } from './DiagnosisBadge';

/** Figma: HistoryItem — miniatura, data e classe. */
export function HistoryItem({ analysis }: { analysis: Analysis }) {
  const { t, formatDate } = useI18n();
  return (
    <Link to={`/historico/${encodeURIComponent(analysis.id)}`} className="gl-history-item">
      <img className="gl-history-item__thumb" src={analysis.imageDataUrl} alt="" loading="lazy" />
      <span className="gl-history-item__body">
        <DiagnosisBadge state={analysis.state} />
        <span className="gl-history-item__date">
          {formatDate(analysis.createdAt)}
          {analysis.source === 'demo' && ` · ${t('history.demoTag')}`}
        </span>
      </span>
      <ChevronRight aria-hidden="true" color="var(--text-muted)" />
    </Link>
  );
}
