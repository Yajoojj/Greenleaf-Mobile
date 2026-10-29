import type { HeatmapCell, HeatmapService } from '../domain/services';

/** DADOS FICTÍCIOS — servem apenas para demonstrar a interface (antes ficavam em HeatmapPage). */
const FAKE_HOTSPOTS: { lon: number; lat: number; intensity: number }[] = [
  { lon: -47.86, lat: -24.52, intensity: 1 },
  { lon: -47.95, lat: -24.42, intensity: 0.7 },
  { lon: -48.08, lat: -24.55, intensity: 0.55 },
  { lon: -47.9, lat: -24.69, intensity: 0.45 },
  { lon: -47.62, lat: -24.35, intensity: 0.35 },
  { lon: -48.12, lat: -24.72, intensity: 0.3 },
];

const CELL_TOTAL = 20;

/** Mapa de calor sem back-end: sempre marcado como fictício na tela. */
export class MockHeatmapService implements HeatmapService {
  readonly simulated = true;

  async cells(): Promise<HeatmapCell[]> {
    return FAKE_HOTSPOTS.map((h) => ({
      latitude: h.lat,
      longitude: h.lon,
      total: CELL_TOTAL,
      infected: Math.round(h.intensity * CELL_TOTAL),
    }));
  }
}
