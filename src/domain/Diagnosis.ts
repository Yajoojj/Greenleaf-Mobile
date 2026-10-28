import type { Analysis, ApiSeverity, DiagnosisState, OtherDisease, PredictionResult, RiskLevel } from './types';

/** Limiar calibrado da IA v2 (`decision.threshold` em greenleaf_effb0.json): a partir dele, "Infectado". */
export const RISK_THRESHOLD_MEDIUM = 0.26;
export const RISK_THRESHOLD_HIGH = 0.6;

/**
 * Nível de risco de bacteriose a partir da probabilidade combinada (0–1):
 * abaixo de 0,26 → baixo; de 0,26 a 0,60 → médio; acima de 0,60 → alto.
 * Com o limiar em 0,26, "33% de chance" ao lado de "Sinais de bacteriose" confundia o produtor.
 */
export function riskLevel(probability: number): RiskLevel {
  const p = Number.isFinite(probability) ? probability : 0;
  if (p < RISK_THRESHOLD_MEDIUM) return 'baixo';
  if (p <= RISK_THRESHOLD_HIGH) return 'medio';
  return 'alto';
}

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
    /** Probabilidade combinada sem arredondar (0–1), base do nível de risco. */
    readonly probability: number = probabilityPercent / 100,
  ) {}

  /** O que a tela principal mostra; a porcentagem fica em "Detalhes técnicos". */
  get riskLevel(): RiskLevel {
    return riskLevel(this.probability);
  }

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
      clamp01(a.probability),
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
    clamp01(raw.probability),
  );
}
