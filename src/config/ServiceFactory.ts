import type { Services } from '../domain/services';
import { LocalAnalysisRepository } from '../data/LocalAnalysisRepository';
import { BrowserImagePreparer } from '../services/BrowserImagePreparer';
import { BrowserLocationService, DisabledLocationService } from '../services/BrowserLocationService';
import { DemoPredictionService } from '../services/DemoPredictionService';
import { HttpPredictionService } from '../services/HttpPredictionService';
import { MockAuthService } from '../services/MockAuthService';
import { MockFeedbackService } from '../services/MockFeedbackService';
import { MockPredictionService } from '../services/MockPredictionService';
import { env, flags } from './env';

export interface FactoryOptions {
  demoMode: boolean;
  apiUrl?: string | null;
  geolocation?: boolean;
}

/**
 * Único lugar que conhece as classes concretas. Para ligar o back-end real,
 * troque as implementações aqui (ex.: SupabaseAuthService) — nenhuma tela muda.
 */
export class ServiceFactory {
  private static shared?: Omit<Services, 'prediction' | 'predictionMode'>;

  static create({ demoMode, apiUrl = env.apiUrl, geolocation = flags.FEATURE_GEOLOCATION }: FactoryOptions): Services {
    this.shared ??= {
      analyses: new LocalAnalysisRepository(),
      auth: new MockAuthService(),
      location: geolocation ? new BrowserLocationService() : new DisabledLocationService(),
      feedback: new MockFeedbackService(),
      images: new BrowserImagePreparer(),
    };

    const live = apiUrl ? new HttpPredictionService(apiUrl) : new MockPredictionService();
    if (demoMode) {
      // Fotos fora dos exemplos usam a análise local, que funciona sem internet.
      return { ...this.shared, prediction: new DemoPredictionService(new MockPredictionService()), predictionMode: 'demo' };
    }
    return { ...this.shared, prediction: live, predictionMode: apiUrl ? 'api' : 'mock' };
  }
}
