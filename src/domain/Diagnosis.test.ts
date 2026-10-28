import { describe, expect, it } from 'vitest';
import { Diagnosis, mapPrediction, toPercent, toRatioPercent } from './Diagnosis';
import type { PredictionResult } from './types';

const base: PredictionResult = {
  probability: 0.5,
  model_probability: 0.6,
  hsv_probability: 0.4,
  class: 'Infectado',
  ratio: 0.05,
  severity: 'Moderada',
  processing_time_ms: 120,
  overlay: 'data:image/png;base64,AAAA',
};

describe('mapPrediction', () => {
  it('Saudavel → sadia e ignora a severidade "Leve" que a API devolve', () => {
    const d = mapPrediction({ ...base, class: 'Saudavel', severity: 'Leve', ratio: 0.004, probability: 0.02 });
    expect(d.state).toBe('sadia');
    expect(d.severity).toBeNull();
    expect(d.isHealthy).toBe(true);
  });

  it('Saudavel + other_disease (servidor v2) → sadia, mas não "isHealthy"', () => {
    const d = mapPrediction({ ...base, class: 'Saudavel', other_disease: 'CMD' });
    expect(d.state).toBe('sadia');
    expect(d.otherDisease).toBe('CMD');
    expect(d.isHealthy).toBe(false);
  });

  it('other_disease é ignorado quando há bacteriose', () => {
    expect(mapPrediction({ ...base, other_disease: 'CMD' }).otherDisease).toBeNull();
  });

  it('resposta do servidor antigo (sem campos v2) continua funcionando', () => {
    const d = mapPrediction({ ...base, class: 'Saudavel' });
    expect(d.otherDisease).toBeNull();
    expect(d.isHealthy).toBe(true);
  });

  it('Saudavel ignora qualquer severidade, mesmo Grave', () => {
    expect(mapPrediction({ ...base, class: 'Saudavel', severity: 'Grave' }).state).toBe('sadia');
  });

  it.each([
    ['Leve', 'leve'],
    ['Moderada', 'moderada'],
    ['Grave', 'grave'],
  ] as const)('Infectado + %s → %s', (severity, state) => {
    const d = mapPrediction({ ...base, severity });
    expect(d.state).toBe(state);
    expect(d.severity).toBe(severity);
    expect(d.isHealthy).toBe(false);
  });

  it('arredonda a probabilidade para % inteiro e a taxa para 1 casa', () => {
    const d = mapPrediction({ ...base, probability: 0.7249, ratio: 0.07834 });
    expect(d.probabilityPercent).toBe(72);
    expect(d.ratioPercent).toBe(7.8);
  });

  it('marca análise só por cor quando model_probability é null', () => {
    expect(mapPrediction({ ...base, model_probability: null }).colorOnly).toBe(true);
    expect(mapPrediction(base).colorOnly).toBe(false);
    expect(mapPrediction({ ...base, model_probability: 0 }).colorOnly).toBe(false);
  });

  it('é pura: não altera a entrada', () => {
    const input = { ...base };
    mapPrediction(input);
    expect(input).toEqual(base);
  });

  it('níveis seguem a escala Sadia → Grave', () => {
    expect(mapPrediction({ ...base, class: 'Saudavel' }).level).toBe(0);
    expect(mapPrediction({ ...base, severity: 'Grave' }).level).toBe(3);
  });
});

describe('conversões', () => {
  it('limita valores fora de 0–1 e não numéricos', () => {
    expect(toPercent(1.4)).toBe(100);
    expect(toPercent(-1)).toBe(0);
    expect(toPercent(Number.NaN)).toBe(0);
    expect(toRatioPercent(0.15)).toBe(15);
  });

  it('Diagnosis.fromAnalysis reproduz o mesmo resultado salvo', () => {
    const d = Diagnosis.fromAnalysis({ state: 'leve', probability: 0.11, ratio: 0.0224, modelProbability: null, severity: 'Leve' });
    expect(d.probabilityPercent).toBe(11);
    expect(d.ratioPercent).toBe(2.2);
    expect(d.colorOnly).toBe(true);
  });
});
