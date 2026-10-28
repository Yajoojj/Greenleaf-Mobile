import { Info } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useServices } from '../app/services';
import type { HeatmapCell } from '../domain/services';
import { useI18n } from '../i18n';
import { StatusMessage } from '../ui';
import { BackLink } from './parts/BackLink';
import { usePageTitle } from './parts/usePageTitle';

/** Coordenadas aproximadas das sedes municipais (só para posicionar rótulos). */
const TOWNS: { name: string; lon: number; lat: number }[] = [
  { name: 'Registro', lon: -47.84, lat: -24.49 },
  { name: 'Sete Barras', lon: -47.93, lat: -24.39 },
  { name: 'Eldorado', lon: -48.11, lat: -24.52 },
  { name: 'Jacupiranga', lon: -48.0, lat: -24.69 },
  { name: 'Pariquera-Açu', lon: -47.88, lat: -24.71 },
  { name: 'Iguape', lon: -47.55, lat: -24.71 },
  { name: 'Cajati', lon: -48.12, lat: -24.74 },
  { name: 'Juquiá', lon: -47.64, lat: -24.32 },
  { name: 'Miracatu', lon: -47.46, lat: -24.28 },
  { name: 'Iporanga', lon: -48.59, lat: -24.59 },
  { name: 'Cananéia', lon: -47.93, lat: -25.01 },
  { name: 'Barra do Turvo', lon: -48.5, lat: -24.76 },
];

const W = 600;
const H = 420;
const x = (lon: number) => ((lon + 48.75) / 1.45) * W;
const y = (lat: number) => ((-24.12 - lat) / 1.0) * H;

/**
 * [FEATURE_HEATMAP] Mapa de calor. Com o Supabase, mostra só células agregadas (≥ 5 análises em ~5 km);
 * sem ele, os dados fictícios do mock, com a etiqueta "Em breve" e o aviso de dados fictícios.
 */
export function HeatmapPage() {
  const { t } = useI18n();
  const { heatmap } = useServices();
  const [cells, setCells] = useState<HeatmapCell[] | null>(null);
  const [failed, setFailed] = useState(false);
  usePageTitle(t('heatmap.title'));

  useEffect(() => {
    let alive = true;
    setFailed(false);
    heatmap.cells().then(
      (c) => alive && setCells(c),
      () => alive && setFailed(true),
    );
    return () => {
      alive = false;
    };
  }, [heatmap]);

  // Intensidade relativa: a célula com mais casos de bacteriose é a mais quente.
  const maxInfected = Math.max(1, ...(cells ?? []).map((c) => c.infected));
  const hotspots = (cells ?? []).filter((c) => c.infected > 0).map((c) => ({ lon: c.longitude, lat: c.latitude, intensity: c.infected / maxInfected }));

  const river = [[-48.62, -24.6], [-48.35, -24.6], [-48.11, -24.52], [-47.95, -24.42], [-47.84, -24.49], [-47.7, -24.55], [-47.55, -24.68]]
    .map(([lo, la], i) => `${i ? 'L' : 'M'}${x(lo).toFixed(1)} ${y(la).toFixed(1)}`)
    .join(' ');

  return (
    <>
      <BackLink />
      <div className="gl-row">
        <h1 className="gl-grow">{t('heatmap.title')}</h1>
        {heatmap.simulated && <span className="gl-badge gl-badge--soon">{t('badge.soon')}</span>}
      </div>
      <p className="gl-muted">{t('heatmap.subtitle')}</p>
      {heatmap.simulated ? (
        <StatusMessage tone="warning" icon="info">{t('heatmap.fake')}</StatusMessage>
      ) : (
        <p className="gl-small gl-muted">{t('heatmap.real')}</p>
      )}
      {failed && <StatusMessage tone="error" role="alert">{t('heatmap.error')}</StatusMessage>}
      {cells !== null && hotspots.length === 0 && !failed && <StatusMessage tone="info" icon="info">{t('heatmap.empty')}</StatusMessage>}

      <figure className="gl-map" style={{ margin: 0 }}>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t(heatmap.simulated ? 'heatmap.mapAlt' : 'heatmap.realAlt')}>
          <defs>
            <radialGradient id="hot">
              <stop offset="0%" stopColor="#C42B2B" stopOpacity="0.85" />
              <stop offset="45%" stopColor="#F07C1E" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#F2B134" stopOpacity="0" />
            </radialGradient>
          </defs>
          {/* oceano e terra (forma simplificada, não é um limite oficial) */}
          <rect width={W} height={H} fill="#DCEBF2" />
          <path
            d={`M0 0 H${W} V${y(-24.62)} C ${x(-47.5)} ${y(-24.7)}, ${x(-47.7)} ${y(-24.85)}, ${x(-47.85)} ${y(-25.0)} C ${x(-47.95)} ${y(-25.08)}, ${x(-48.05)} ${y(-25.1)}, ${x(-48.15)} ${y(-25.12)} H0 Z`}
            fill="#EEF3E6"
            stroke="#B5C9A5"
          />
          <path d={river} fill="none" stroke="#7FB3CF" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          {hotspots.map((h, i) => (
            <circle key={i} cx={x(h.lon)} cy={y(h.lat)} r={30 + 50 * h.intensity} fill="url(#hot)" opacity={0.5 + 0.5 * h.intensity} />
          ))}
          {TOWNS.map((tw) => (
            <g key={tw.name}>
              <circle cx={x(tw.lon)} cy={y(tw.lat)} r="4" fill="#1F1F1F" />
              <text x={x(tw.lon) + 7} y={y(tw.lat) + 4} fontSize="13" fontWeight="600" fill="#1F1F1F" stroke="#fff" strokeWidth="3" paintOrder="stroke">
                {tw.name}
              </text>
            </g>
          ))}
        </svg>
        <figcaption className="gl-stack gl-stack--sm" style={{ padding: 'var(--space-3)', background: 'var(--surface-card)' }}>
          <span className="gl-small" style={{ fontWeight: 600 }}>{t('heatmap.legend')}</span>
          <span className="gl-row gl-small">
            {t('heatmap.low')}
            <span aria-hidden="true" style={{ flex: 1, height: 12, borderRadius: 6, background: 'linear-gradient(90deg, #F2B134, #F07C1E, #C42B2B)' }} />
            {t('heatmap.high')}
          </span>
        </figcaption>
      </figure>
      <p className="gl-small gl-muted gl-row" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
        <Info size={18} aria-hidden="true" style={{ flex: 'none', marginTop: 3 }} />
        {t('location.what')}
      </p>
    </>
  );
}
