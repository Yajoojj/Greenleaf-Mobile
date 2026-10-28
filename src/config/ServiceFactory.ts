import type { Services } from '../domain/services';
import { CloudAnalysisRepository } from '../data/CloudAnalysisRepository';
import { LocalAnalysisRepository } from '../data/LocalAnalysisRepository';
import { SessionAwareAnalysisRepository } from '../data/SessionAwareAnalysisRepository';
import { BrowserImagePreparer } from '../services/BrowserImagePreparer';
import { BrowserLocationService, DisabledLocationService } from '../services/BrowserLocationService';
import { DemoPredictionService } from '../services/DemoPredictionService';
import { HttpPredictionService } from '../services/HttpPredictionService';
import { MockAuthService } from '../services/MockAuthService';
import { MockFeedbackService } from '../services/MockFeedbackService';
import { MockHeatmapService } from '../services/MockHeatmapService';
import { MockPredictionService } from '../services/MockPredictionService';
import { SupabaseAuthService } from '../services/SupabaseAuthService';
import { SupabaseFeedbackService } from '../services/SupabaseFeedbackService';
import { SupabaseHeatmapService } from '../services/SupabaseHeatmapService';
import { createSupabase } from '../services/supabaseClient';
import { env, flags, type SupabaseConfig } from './env';

export interface FactoryOptions {
  demoMode: boolean;
  apiUrl?: string | null;
  geolocation?: boolean;
  /** Back-end do app; `null` mantém os mocks (o app funciona exatamente como antes). */
  supabase?: SupabaseConfig | null;
}

type SharedServices = Omit<Services, 'prediction' | 'predictionMode'>;

/**
 * Único lugar que conhece as classes concretas. Com VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
 * usa o Supabase; sem elas, os mocks locais — nenhuma tela muda.
 */
export class ServiceFactory {
  private static shared?: SharedServices;

  private static createShared(supabase: SupabaseConfig | null, geolocation: boolean): SharedServices {
    const local = new LocalAnalysisRepository();
    const common = {
      location: geolocation ? new BrowserLocationService() : new DisabledLocationService(),
      images: new BrowserImagePreparer(),
    };
    if (!supabase) {
      return {
        ...common,
        analyses: local,
        auth: new MockAuthService(),
        feedback: new MockFeedbackService(),
        heatmap: new MockHeatmapService(),
        accountMode: 'local',
      };
    }
    const client = createSupabase(supabase.url, supabase.anonKey);
    const auth = new SupabaseAuthService(client, typeof window !== 'undefined' ? window.location.origin : undefined);
    const analyses = new SessionAwareAnalysisRepository({
      local,
      cloud: new CloudAnalysisRepository(client),
      outboxFor: (userId) => new LocalAnalysisRepository(indexedDB, `greenleaf-outbox-${userId}`),
      auth,
    });
    return {
      ...common,
      analyses,
      historySync: analyses,
      auth,
      feedback: new SupabaseFeedbackService(client, env.version),
      heatmap: new SupabaseHeatmapService(client),
      accountMode: 'cloud',
    };
  }

  static create({ demoMode, apiUrl = env.apiUrl, geolocation = flags.FEATURE_GEOLOCATION, supabase = env.supabase }: FactoryOptions): Services {
    this.shared ??= this.createShared(supabase, geolocation);

    const live = apiUrl ? new HttpPredictionService(apiUrl) : new MockPredictionService();
    if (demoMode) {
      // Fotos fora dos exemplos usam a análise local, que funciona sem internet.
      return { ...this.shared, prediction: new DemoPredictionService(new MockPredictionService()), predictionMode: 'demo' };
    }
    return { ...this.shared, prediction: live, predictionMode: apiUrl ? 'api' : 'mock' };
  }
}
