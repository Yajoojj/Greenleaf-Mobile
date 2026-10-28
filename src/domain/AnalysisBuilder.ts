import { mapPrediction } from './Diagnosis';
import type { Analysis, AnalysisSource, PredictionResult } from './types';

export interface BuildAnalysisInput {
  result: PredictionResult;
  imageDataUrl: string;
  source: AnalysisSource;
  simulated: boolean;
  position?: { latitude: number; longitude: number } | null;
  now?: Date;
  id?: string;
}

/** Monta a entidade Analysis a partir da resposta da IA e da foto enviada. */
export class AnalysisBuilder {
  static build({ result, imageDataUrl, source, simulated, position, now = new Date(), id }: BuildAnalysisInput): Analysis {
    const diagnosis = mapPrediction(result);
    const analysis: Analysis = {
      id: id ?? AnalysisBuilder.newId(),
      createdAt: now.toISOString(),
      state: diagnosis.state,
      probability: result.probability,
      modelProbability: result.model_probability,
      hsvProbability: result.hsv_probability,
      ratio: result.ratio,
      severity: diagnosis.severity,
      processingTimeMs: result.processing_time_ms,
      imageDataUrl,
      overlayDataUrl: result.overlay,
      source,
      simulated,
    };
    if (position) {
      analysis.latitude = position.latitude;
      analysis.longitude = position.longitude;
    }
    return analysis;
  }

  static newId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
    return `a-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}
