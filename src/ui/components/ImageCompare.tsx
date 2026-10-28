import { Image as ImageIcon, ScanSearch } from 'lucide-react';
import { useState } from 'react';
import { useI18n } from '../../i18n';
import { SegmentedControl } from './SegmentedControl';

/** Figma: ImageCompare — alterna foto original e área destacada, com legenda. */
export function ImageCompare({ original, overlay }: { original: string; overlay: string }) {
  const { t } = useI18n();
  const [view, setView] = useState<'overlay' | 'original'>('overlay');
  return (
    <figure className="gl-image-compare" style={{ margin: 0 }}>
      <SegmentedControl
        label={t('result.view.overlay')}
        value={view}
        onChange={setView}
        options={[
          { value: 'overlay', label: t('result.view.overlay'), icon: <ScanSearch size={18} aria-hidden="true" /> },
          { value: 'original', label: t('result.view.original'), icon: <ImageIcon size={18} aria-hidden="true" /> },
        ]}
      />
      <div className="gl-image-compare__frame">
        {view === 'overlay' ? (
          <img src={overlay} alt={t('result.imageAlt.overlay')} />
        ) : (
          <img src={original} alt={t('result.imageAlt.original')} />
        )}
      </div>
      {view === 'overlay' && (
        <figcaption className="gl-legend">
          <span className="gl-legend__item">
            <span className="gl-legend__swatch" style={{ background: 'rgb(87 184 70)' }} aria-hidden="true" />
            {t('result.legend.leaf')}
          </span>
          <span className="gl-legend__item">
            <span className="gl-legend__swatch" style={{ background: 'rgb(255 93 93)' }} aria-hidden="true" />
            {t('result.legend.lesion')}
          </span>
        </figcaption>
      )}
    </figure>
  );
}
