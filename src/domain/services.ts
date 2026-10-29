import type { Analysis, DiagnosisState, Feedback, HealthStatus, PredictionResult, User } from './types';

/**
 * Contratos que as telas conhecem. As implementações ficam em src/services e src/data
 * e são escolhidas pela fábrica em src/config — telas nunca importam classes concretas.
 */

export interface PredictionProgress {
  /** Chamado quando a imagem terminou de subir e o servidor começou a analisar. */
  onUploaded?: () => void;
}

export interface PredictionService {
  /** `progress` é opcional e extra ao contrato original (ver docs/decisoes.md, D-07). */
  predict(file: Blob, signal?: AbortSignal, progress?: PredictionProgress): Promise<PredictionResult>;
  health(): Promise<HealthStatus>;
}

export interface AnalysisRepository {
  save(a: Analysis): Promise<Analysis>;
  list(filter?: { state?: DiagnosisState }): Promise<Analysis[]>;
  get(id: string): Promise<Analysis | null>;
  remove(id: string): Promise<void>;
  /** Extra: apaga todo o histórico local (LGPD — "apagar dados locais"). */
  clear(): Promise<void>;
}

export interface AuthService {
  signUp(name: string, email: string, password: string): Promise<User>;
  signIn(email: string, password: string): Promise<User>;
  signOut(): Promise<void>;
  currentUser(): Promise<User | null>;
  deleteAccount(): Promise<void>;
}

export interface LocationService {
  requestConsent(): Promise<boolean>;
  getPosition(): Promise<{ latitude: number; longitude: number } | null>;
  /** Extras: retirar o consentimento (LGPD) e saber se ele existe. */
  revokeConsent(): Promise<void>;
  consentStatus(): Promise<boolean>;
}

export interface FeedbackService {
  send(feedback: Feedback): Promise<void>;
}

/** Célula do mapa de calor: só dados agregados (centro de uma grade de ~5 km). */
export interface HeatmapCell {
  latitude: number;
  longitude: number;
  total: number;
  /** Análises com bacteriose na célula. */
  infected: number;
}

export interface HeatmapService {
  /** `true` quando os dados são fictícios (a tela mostra a etiqueta "dados fictícios"). */
  readonly simulated: boolean;
  cells(): Promise<HeatmapCell[]>;
}

/** Histórico deste aparelho que pode subir para a conta (primeiro login). Demonstrações nunca sobem. */
export interface HistorySync {
  /** Quantas análises locais (não de demonstração) podem ser enviadas para a conta logada. */
  pendingLocal(): Promise<number>;
  /** Envia essas análises para a conta e as tira do aparelho. Devolve quantas foram enviadas. */
  uploadLocal(): Promise<number>;
}

/** Preparação da foto no aparelho (validar, girar, reduzir, remover EXIF). */
export interface ImagePreparer {
  validate(file: Blob): void;
  prepare(file: Blob): Promise<Blob>;
  toDataUrl(blob: Blob): Promise<string>;
}

export interface Services {
  prediction: PredictionService;
  analyses: AnalysisRepository;
  auth: AuthService;
  location: LocationService;
  feedback: FeedbackService;
  images: ImagePreparer;
  heatmap: HeatmapService;
  /** Só existe com o back-end real (Supabase). */
  historySync?: HistorySync;
  /** `cloud`: contas e histórico no Supabase; `local`: mocks, tudo só no aparelho. Escolhe os textos certos. */
  accountMode: 'cloud' | 'local';
  /** Qual implementação de predição está ativa (para selos e textos de status). */
  predictionMode: 'api' | 'mock' | 'demo';
}
