/** Estados que o produtor vê. "sadia" nunca exibe severidade. */
export type DiagnosisState = 'sadia' | 'leve' | 'moderada' | 'grave';

export const DIAGNOSIS_STATES: readonly DiagnosisState[] = ['sadia', 'leve', 'moderada', 'grave'];

/** Valores exatos devolvidos pelo Axios Cassava IA (sem acento). */
export type ApiClass = 'Infectado' | 'Saudavel';
export type ApiSeverity = 'Leve' | 'Moderada' | 'Grave';

/** Outras doenças que o modelo v2 (5 classes do Kaggle Cassava) reconhece. */
export type OtherDisease = 'CBSD' | 'CGM' | 'CMD';

/** Corpo de `POST /predict` (backend/main.py). */
export interface PredictionResult {
  probability: number;
  model_probability: number | null;
  hsv_probability: number;
  class: ApiClass;
  ratio: number;
  severity: ApiSeverity;
  processing_time_ms: number;
  overlay: string;
  /**
   * Extras do servidor GreenLeaf IA v2 (opcionais: o servidor antigo, o mock e a demonstração não mandam).
   * `other_disease`: bacteriose descartada, mas a folha tem sinais de outra doença.
   */
  other_disease?: OtherDisease | null;
  model_version?: string | null;
}

/** Corpo de `GET /health`. */
export interface HealthStatus {
  status: string;
  version: string;
  environment: string;
  model_loaded: boolean;
  supabase_logging: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export type AnalysisSource = 'camera' | 'gallery' | 'demo';

/** Uma análise salva no histórico (Analise no diagrama de classes). */
export interface Analysis {
  id: string;
  createdAt: string;
  state: DiagnosisState;
  /** Probabilidade combinada (0–1). */
  probability: number;
  modelProbability: number | null;
  hsvProbability: number;
  /** Taxa de infecção: fração da folha com manchas (0–1). */
  ratio: number;
  /** Severidade da API; `null` quando a folha é sadia. */
  severity: ApiSeverity | null;
  processingTimeMs: number;
  imageDataUrl: string;
  overlayDataUrl: string;
  /** Outra doença provável quando a bacteriose foi descartada (servidor v2). */
  otherDisease?: OtherDisease | null;
  modelVersion?: string | null;
  latitude?: number;
  longitude?: number;
  /** Extra do front: origem da foto (demonstração aparece marcada). */
  source?: AnalysisSource;
  /** Extra do front: resultado veio de um serviço simulado (mock/demonstração). */
  simulated?: boolean;
}

export interface Feedback {
  topic: 'duvida' | 'problema' | 'sugestao' | 'elogio';
  message: string;
  contactEmail?: string;
  /** Avaliação da experiência, 1 (muito difícil) a 5 (muito fácil). */
  rating?: number;
}
