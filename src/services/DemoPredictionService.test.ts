import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { mapPrediction } from '../domain/Diagnosis';
import { predictionResultSchema } from '../domain/schemas';
import type { PredictionService } from '../domain/services';
import { DemoPredictionService } from './DemoPredictionService';
import { RECORDED_CASES } from './MockPredictionService';

const publicDir = resolve(__dirname, '../../public');
const file = (url: string) => new Blob([readFileSync(resolve(publicDir, `.${url}`))], { type: url.endsWith('.png') ? 'image/png' : 'image/jpeg' });
const fakeFetch = (async (url: string) => ({ blob: async () => file(url) })) as unknown as typeof fetch;

describe('DemoPredictionService', () => {
  it('os 5 exemplos têm respostas reais da IA v2 (não "apenas pela cor") com overlay JPEG', () => {
    expect(RECORDED_CASES).toHaveLength(5);
    for (const c of RECORDED_CASES) {
      expect(c.response.model_probability, c.id).not.toBeNull();
      expect(c.response.model_version, c.id).toBe('greenleaf_effb0-2026-10-28');
      expect(Object.keys(c.response.class_probabilities ?? {}).sort(), c.id).toEqual(['CBB', 'CBSD', 'CGM', 'CMD', 'Healthy']);
      expect(c.response.overlay, c.id).toMatch(/^\/demo\/.+-overlay\.jpg$/);
      expect(mapPrediction({ ...c.response, overlay: 'data:image/jpeg;base64,AA==' }).colorOnly, c.id).toBe(false);
    }
  });

  it('inclui sadia, bacteriose e o caso "sem bacteriose — outra doença" (mosaico)', () => {
    const d = RECORDED_CASES.map((c) => mapPrediction({ ...c.response, overlay: 'data:image/jpeg;base64,AA==' }));
    expect(d.some((x) => x.isHealthy)).toBe(true);
    expect(d.some((x) => x.state !== 'sadia')).toBe(true);
    const other = d.find((x) => x.otherDisease !== null)!;
    expect(other.otherDisease).toBe('CMD');
    expect(other.state).toBe('sadia');
    expect(other.severity).toBeNull(); // a API manda "Moderada", mas sem bacteriose não há severidade
  });

  it('a folha sadia gravada vem com severity "Leve" e mesmo assim vira Sadia', () => {
    const sadia = RECORDED_CASES.find((c) => c.id === 'sadia')!;
    expect(sadia.response.severity).toBe('Leve');
    expect(mapPrediction({ ...sadia.response, overlay: 'data:image/png;base64,AA==' }).severity).toBeNull();
  });

  it('reconhece cada exemplo pelo conteúdo e devolve a resposta gravada com overlay em data URL', async () => {
    const fallback: PredictionService = { predict: vi.fn(), health: vi.fn() };
    const demo = new DemoPredictionService(fallback, 0, fakeFetch);
    for (const c of RECORDED_CASES) {
      const r = await demo.predict(file(c.image));
      expect(predictionResultSchema.safeParse(r).success).toBe(true);
      expect(r.ratio).toBe(c.response.ratio);
    }
    expect(fallback.predict).not.toHaveBeenCalled();
  });

  it('foto desconhecida vai para o serviço de reserva', async () => {
    const predict = vi.fn().mockResolvedValue('fallback');
    const demo = new DemoPredictionService({ predict, health: vi.fn() }, 0, fakeFetch);
    expect(await demo.predict(new Blob([new Uint8Array([9, 9, 9])], { type: 'image/jpeg' }))).toBe('fallback');
  });
});
