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
