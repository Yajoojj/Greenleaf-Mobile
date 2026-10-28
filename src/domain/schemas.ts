import { z } from 'zod';
import type { HealthStatus, PredictionResult } from './types';

const unit = z.number().finite().min(0).max(1);

/**
 * O overlay é exibido em <img>; aceitamos somente data URL de PNG/JPEG em base64
 * para nunca carregar endereço externo nem conteúdo ativo (SVG/HTML) vindo da API.
 */
const IMAGE_DATA_URL = /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+=*$/;

export const predictionResultSchema = z.object({
  probability: unit,
  model_probability: unit.nullable(),
  hsv_probability: unit,
  class: z.enum(['Infectado', 'Saudavel']),
  ratio: unit,
  severity: z.enum(['Leve', 'Moderada', 'Grave']),
  processing_time_ms: z.number().finite().min(0),
  overlay: z.string().max(16_000_000).regex(IMAGE_DATA_URL, 'overlay inválido'),
  // Extras do servidor v2. Opcionais para continuar aceitando o servidor antigo;
  // os demais campos novos (`diagnosis`, `class_probabilities`) são descartados pelo zod.
  other_disease: z.enum(['CBSD', 'CGM', 'CMD']).nullable().optional(),
  model_version: z.string().max(80).nullable().optional(),
}) satisfies z.ZodType<PredictionResult>;

export const healthStatusSchema = z.object({
  status: z.string().max(50),
  version: z.string().max(50),
  environment: z.string().max(50),
  model_loaded: z.boolean(),
  supabase_logging: z.boolean(),
}) satisfies z.ZodType<HealthStatus>;

export function isImageDataUrl(value: string): boolean {
  return IMAGE_DATA_URL.test(value);
}
