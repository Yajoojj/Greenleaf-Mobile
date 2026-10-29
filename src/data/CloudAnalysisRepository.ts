import { AuthError } from '../domain/errors';
import { classProbabilitiesSchema } from '../domain/schemas';
import type { AnalysisRepository } from '../domain/services';
import type { Analysis, ApiSeverity, ClassProbabilities, DiagnosisState, ModelClass, OtherDisease, TopClass } from '../domain/types';
import { MODEL_CLASSES } from '../domain/types';
import type { GreenLeafSupabase } from '../services/supabaseClient';
import type { Database } from './supabase.types';

const BUCKET = 'leaves';
/** URLs assinadas curtas: a foto só abre enquanto a tela está aberta. */
const SIGNED_URL_TTL_S = 10 * 60;

type AnalysisRow = Database['public']['Tables']['analyses']['Row'];
type AnalysisInsert = Database['public']['Tables']['analyses']['Insert'];
type LocationEmbed = { latitude: number; longitude: number } | { latitude: number; longitude: number }[] | null;
type RowWithLocation = AnalysisRow & { locations: LocationEmbed };

/** O banco recusou os dados (restrição, permissão): reenviar não adianta. */
export class CloudRejectedError extends Error {
  constructor(reason: string) {
    super(`cloud_rejected:${reason}`);
    this.name = 'CloudRejectedError';
  }
}

export type JpegEncoder = (blob: Blob) => Promise<Blob>;

/** Data URL → Blob sem fetch (a CSP não libera connect-src para data:). */
export function dataUrlToBlob(dataUrl: string): Blob {
  const [head, body = ''] = dataUrl.split(',', 2);
  const type = /data:([^;]+)/.exec(head)?.[1] ?? 'application/octet-stream';
  const bin = atob(body);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

/** Garante JPEG (o overlay da IA v2 já vem em JPEG; PNG antigo é recodificado no aparelho). */
export const canvasJpegEncoder: JpegEncoder = async (blob) => {
  if (blob.type === 'image/jpeg') return blob;
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0);
  bitmap.close();
  const out = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
  if (!out) throw new Error('jpeg_encode_failed');
  return out;
};

const round2 = (n: number) => Math.round(n * 100) / 100;
const isDemo = (a: Analysis) => a.source === 'demo' || a.simulated === true;

function parseClassProbabilities(value: unknown): ClassProbabilities | null {
  const parsed = classProbabilitiesSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** A classe mais provável sai das 5 probabilidades (o rótulo é traduzido na tela pelo código). */
function topClassOf(p: ClassProbabilities | null): TopClass | null {
  if (!p) return null;
  const code = MODEL_CLASSES.reduce<ModelClass>((best, c) => (p[c] > p[best] ? c : best), 'CBB');
  return { code, label: code, probability: p[code] };
}

/**
 * Histórico na nuvem (Supabase). Fotos no bucket privado `leaves`, em {user_id}/{analysis_id}/;
 * as telas recebem URLs assinadas de curta duração nos mesmos campos `imageDataUrl`/`overlayDataUrl`.
 */
export class CloudAnalysisRepository implements AnalysisRepository {
  constructor(private readonly client: GreenLeafSupabase, private readonly toJpeg: JpegEncoder = canvasJpegEncoder) {}

  private async userId(): Promise<string> {
    const { data } = await this.client.auth.getSession();
    const id = data.session?.user.id;
    if (!id) throw new AuthError('not_signed_in');
    return id;
  }

  private async upload(path: string, blob: Blob): Promise<void> {
    const { error } = await this.client.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: false });
    if (!error) return;
    // Reenvio do mesmo id (fila offline): o arquivo já está lá.
    const status = (error as { statusCode?: string | number }).statusCode;
    if (String(status) === '409' || /already exists|duplicate/i.test(error.message)) return;
    if (String(status) === '403' || String(status) === '400' || String(status) === '413') throw new CloudRejectedError('storage');
    throw new Error('storage_failed');
  }

  async save(a: Analysis): Promise<Analysis> {
    if (isDemo(a)) throw new CloudRejectedError('demo'); // demonstração nunca vai para a nuvem
    const userId = await this.userId();
    const base = `${userId}/${a.id}`;
    const [image, overlay] = await Promise.all([this.toJpeg(dataUrlToBlob(a.imageDataUrl)), this.toJpeg(dataUrlToBlob(a.overlayDataUrl))]);
    await this.upload(`${base}/original.jpg`, image);
    await this.upload(`${base}/overlay.jpg`, overlay);

    const row: AnalysisInsert = {
      id: a.id,
      user_id: userId,
      created_at: a.createdAt,
      state: a.state,
      probability: a.probability,
      model_probability: a.modelProbability,
      hsv_probability: a.hsvProbability,
      ratio: a.ratio,
      severity: a.state === 'sadia' ? null : a.severity,
      other_disease: a.state === 'sadia' ? (a.otherDisease ?? null) : null,
      class_probabilities: a.classProbabilities ?? null,
      model_version: a.modelVersion ?? null,
      processing_time_ms: Math.max(0, Math.round(a.processingTimeMs)),
      source: a.source === 'gallery' ? 'gallery' : 'camera',
      image_path: `${base}/original.jpg`,
      overlay_path: `${base}/overlay.jpg`,
    };
    // ON CONFLICT DO NOTHING: o id gerado no app torna o envio idempotente.
    const inserted = await this.client.from('analyses').upsert(row, { onConflict: 'id', ignoreDuplicates: true });
    if (inserted.error) throw this.classify(inserted.error);

    if (typeof a.latitude === 'number' && typeof a.longitude === 'number') {
      const located = await this.client
        .from('locations')
        .upsert(
          { analysis_id: a.id, latitude: round2(a.latitude), longitude: round2(a.longitude), consent: true },
          { onConflict: 'analysis_id', ignoreDuplicates: true },
        );
      if (located.error) throw this.classify(located.error);
    }
    return a;
  }

  /** Erros 22xxx/23xxx/42xxx (dados ou permissão) não melhoram com nova tentativa. */
  private classify(error: { code?: string }): Error {
    return /^(22|23|42)/.test(error.code ?? '') ? new CloudRejectedError(error.code ?? 'db') : new Error('cloud_failed');
  }

  private async toAnalyses(rows: RowWithLocation[]): Promise<Analysis[]> {
    if (rows.length === 0) return [];
    const paths = rows.flatMap((r) => [r.image_path, r.overlay_path]);
    const { data, error } = await this.client.storage.from(BUCKET).createSignedUrls(paths, SIGNED_URL_TTL_S);
    if (error) throw new Error('signed_urls_failed');
    const urls = new Map((data ?? []).map((d) => [d.path, d.signedUrl]));
    return rows.map((r) => {
      const location = Array.isArray(r.locations) ? r.locations[0] : r.locations;
      const classProbabilities = parseClassProbabilities(r.class_probabilities);
      const a: Analysis = {
        id: r.id,
        createdAt: r.created_at,
        state: r.state as DiagnosisState,
        probability: r.probability,
        modelProbability: r.model_probability,
        hsvProbability: r.hsv_probability,
        ratio: r.ratio,
        severity: (r.severity as ApiSeverity | null) ?? null,
        processingTimeMs: r.processing_time_ms,
        imageDataUrl: urls.get(r.image_path) ?? '',
        overlayDataUrl: urls.get(r.overlay_path) ?? '',
        otherDisease: (r.other_disease as OtherDisease | null) ?? null,
        modelVersion: r.model_version,
        classProbabilities,
        topClass: topClassOf(classProbabilities),
        source: r.source === 'gallery' ? 'gallery' : 'camera',
        simulated: false,
      };
      if (location) {
        a.latitude = Number(location.latitude);
        a.longitude = Number(location.longitude);
      }
      return a;
    });
  }

  async list(filter?: { state?: DiagnosisState }): Promise<Analysis[]> {
    let query = this.client.from('analyses').select('*, locations(latitude, longitude)').order('created_at', { ascending: false });
    if (filter?.state) query = query.eq('state', filter.state);
    const { data, error } = await query;
    if (error) throw new Error('cloud_list_failed');
    return this.toAnalyses((data ?? []) as RowWithLocation[]);
  }

  async get(id: string): Promise<Analysis | null> {
    const { data, error } = await this.client.from('analyses').select('*, locations(latitude, longitude)').eq('id', id).maybeSingle();
    if (error) throw new Error('cloud_get_failed');
    if (!data) return null;
    const [a] = await this.toAnalyses([data as RowWithLocation]);
    return a;
  }

  async remove(id: string): Promise<void> {
    const userId = await this.userId();
    await this.client.storage.from(BUCKET).remove([`${userId}/${id}/original.jpg`, `${userId}/${id}/overlay.jpg`]);
    const { error } = await this.client.from('analyses').delete().eq('id', id);
    if (error) throw new Error('cloud_remove_failed');
  }

  /** Apaga só as análises (e fotos) do usuário logado. */
  async clear(): Promise<void> {
    const userId = await this.userId();
    const { data, error } = await this.client.from('analyses').select('image_path, overlay_path').eq('user_id', userId);
    if (error) throw new Error('cloud_clear_failed');
    const paths = (data ?? []).flatMap((r) => [r.image_path, r.overlay_path]);
    for (let i = 0; i < paths.length; i += 100) {
      await this.client.storage.from(BUCKET).remove(paths.slice(i, i + 100));
    }
    const removed = await this.client.from('analyses').delete().eq('user_id', userId);
    if (removed.error) throw new Error('cloud_clear_failed');
  }
}
