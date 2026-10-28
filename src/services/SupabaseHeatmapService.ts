import type { HeatmapCell, HeatmapService } from '../domain/services';
import type { GreenLeafSupabase } from './supabaseClient';

/**
 * Mapa de calor real: `heatmap_cells()` só devolve células de ~5 km com 5 ou mais análises com consentimento,
 * sem coordenadas, ids ou datas individuais.
 */
export class SupabaseHeatmapService implements HeatmapService {
  readonly simulated = false;

  constructor(private readonly client: GreenLeafSupabase) {}

  async cells(): Promise<HeatmapCell[]> {
    const { data, error } = await this.client.rpc('heatmap_cells');
    if (error) throw new Error('heatmap_failed');
    return (data ?? []).map((c) => ({
      latitude: Number(c.latitude),
      longitude: Number(c.longitude),
      total: c.total,
      infected: c.infected,
    }));
  }
}
