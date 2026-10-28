import { describe, expect, it } from 'vitest';
import cases from '../services/fixtures/demo-cases.json';
import { healthStatusSchema, predictionResultSchema } from './schemas';

const valid = {
  probability: 0.3,
  model_probability: null,
  hsv_probability: 0.3,
  class: 'Infectado',
  ratio: 0.06,
  severity: 'Moderada',
  processing_time_ms: 10,
  overlay: 'data:image/png;base64,iVBORw0KGgo=',
};

describe('predictionResultSchema', () => {
  it('aceita a resposta no formato do servidor', () => {
    expect(predictionResultSchema.safeParse(valid).success).toBe(true);
  });

  it('aceita a resposta do servidor v2 e guarda as 5 probabilidades e a classe mais provável', () => {
    const r = predictionResultSchema.safeParse({
      ...valid,
      class: 'Saudavel',
      overlay: 'data:image/jpeg;base64,/9j/4AAQ',
      other_disease: 'CMD',
      model_version: 'greenleaf_effb0-2026-10-28',
      diagnosis: { code: 'CMD', label: 'Mosaico (CMD)', probability: 0.9 },
      class_probabilities: { CBB: 0.02, CBSD: 0.03, CGM: 0.03, CMD: 0.9, Healthy: 0.02 },
    });
    expect(r.success).toBe(true);
    expect(r.success && r.data.other_disease).toBe('CMD');
    expect(r.success && r.data.class_probabilities?.CMD).toBe(0.9);
    expect(r.success && r.data.diagnosis?.code).toBe('CMD');
  });

  it('campos v2 continuam opcionais e são validados quando vêm', () => {
    expect(predictionResultSchema.safeParse({ ...valid, class_probabilities: { CBB: 2, CBSD: 0, CGM: 0, CMD: 0, Healthy: 0 } }).success).toBe(false);
    expect(predictionResultSchema.safeParse({ ...valid, diagnosis: { code: 'XYZ', label: 'x', probability: 0.5 } }).success).toBe(false);
    expect(healthStatusSchema.safeParse({ status: 'ok', version: '2', environment: 'p', model_loaded: true, supabase_logging: false, model_version: 'm' }).success).toBe(true);
  });

  it('rejeita other_disease desconhecida', () => {
    expect(predictionResultSchema.safeParse({ ...valid, other_disease: 'CBB' }).success).toBe(false);
  });

  it('as respostas gravadas da demonstração seguem o contrato (com overlay em data URL)', () => {
    for (const c of cases) {
      const r = predictionResultSchema.safeParse({ ...c.response, overlay: valid.overlay });
      expect(r.success, c.id).toBe(true);
    }
  });

  it.each([
    ['classe com acento', { class: 'Saudável' }],
    ['severidade desconhecida', { severity: 'Altissima' }],
    ['probabilidade fora de 0–1', { probability: 1.5 }],
    ['overlay com URL externa', { overlay: 'https://evil.example/x.png' }],
    ['overlay SVG (conteúdo ativo)', { overlay: 'data:image/svg+xml;base64,PHN2Zz4=' }],
    ['overlay com HTML', { overlay: 'data:text/html;base64,PGgxPg==' }],
    ['campo ausente', { ratio: undefined }],
  ])('rejeita %s', (_, patch) => {
    expect(predictionResultSchema.safeParse({ ...valid, ...patch }).success).toBe(false);
  });
});

describe('healthStatusSchema', () => {
  it('aceita GET /health', () => {
    expect(
      healthStatusSchema.safeParse({ status: 'ok', version: '1.0.0', environment: 'production', model_loaded: true, supabase_logging: false }).success,
    ).toBe(true);
  });
  it('rejeita tipos errados', () => {
    expect(healthStatusSchema.safeParse({ status: 'ok', version: 1, environment: 'x', model_loaded: 'yes', supabase_logging: false }).success).toBe(false);
  });
});
