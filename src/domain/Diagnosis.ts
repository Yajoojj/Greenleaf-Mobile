import type { Analysis, ApiSeverity, DiagnosisState, OtherDisease, PredictionResult } from './types';

const SEVERITY_TO_STATE: Record<ApiSeverity, DiagnosisState> = {
  Leve: 'leve',
  Moderada: 'moderada',
  Grave: 'grave',
};

/** Valor exibível de um diagnóstico, já traduzido para a linguagem do produtor. */
export class Diagnosis {
  constructor(
    readonly state: DiagnosisState,
    /** Chance estimada de bacteriose, em % inteiro (0–100). */
    readonly probabilityPercent: number,
    /** Parte da folha com manchas, em % com uma casa decimal. */
    readonly ratioPercent: number,
    /** `true` quando o modelo de IA não respondeu e só a análise de cor foi usada. */
    readonly colorOnly: boolean,
    /** Severidade da API, `null` para folha sadia. */
    readonly severity: ApiSeverity | null,
    /** Sem bacteriose, mas com sinais de outra doença (só no estado `sadia`). */
    readonly otherDisease: OtherDisease | null = null,
  ) {}

  get isHealthy(): boolean {
    return this.state === 'sadia' && this.otherDisease === null;
  }

  /** Posição na escala Sadia → Grave (0 a 3). */
  get level(): number {
    return ['sadia', 'leve', 'moderada', 'grave'].indexOf(this.state);
  }

  static fromAnalysis(a: Pick<Analysis, 'state' | 'probability' | 'ratio' | 'modelProbability' | 'severity' | 'otherDisease'>): Diagnosis {
    return new Diagnosis(
      a.state,
      toPercent(a.probability),
      toRatioPercent(a.ratio),
      a.modelProbability === null,
      a.severity,
      a.state === 'sadia' ? (a.otherDisease ?? null) : null,
    );
  }
}

function clamp01(n: number): number {
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;
}

export function toPercent(p: number): number {
  return Math.round(clamp01(p) * 100);
}

export function toRatioPercent(r: number): number {
  return Math.round(clamp01(r) * 1000) / 10;
}

/**
 * Converte a resposta do Axios Cassava IA no estado exibido.
 * - `Saudavel` → Sadia, ignorando `severity` (a API devolve "Leve" mesmo para folha sadia).
 * - `Infectado` → Leve / Moderada / Grave conforme `severity`.
 * - `other_disease` (servidor v2) só vale para `Saudavel`: sem bacteriose, mas com outra doença.
 * Função pura: sem efeitos colaterais nem dependência de tela.
 */
export function mapPrediction(raw: PredictionResult): Diagnosis {
  const healthy = raw.class === 'Saudavel';
  const state: DiagnosisState = healthy ? 'sadia' : SEVERITY_TO_STATE[raw.severity];
  return new Diagnosis(
    state,
    toPercent(raw.probability),
    toRatioPercent(raw.ratio),
    raw.model_probability === null,
    healthy ? null : raw.severity,
    healthy ? (raw.other_disease ?? null) : null,
  );
}
