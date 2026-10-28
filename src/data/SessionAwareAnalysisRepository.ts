import type { AnalysisRepository, AuthService, HistorySync } from '../domain/services';
import type { Analysis, DiagnosisState } from '../domain/types';
import { CloudRejectedError } from './CloudAnalysisRepository';

const isDemo = (a: Analysis) => a.source === 'demo' || a.simulated === true;

const newestFirst = (x: Analysis, y: Analysis) => y.createdAt.localeCompare(x.createdAt);

function mergeById(...lists: Analysis[][]): Analysis[] {
  const byId = new Map<string, Analysis>();
  for (const list of lists) for (const a of list) if (!byId.has(a.id)) byId.set(a.id, a);
  return [...byId.values()].sort(newestFirst);
}

export interface SessionAwareOptions {
  local: AnalysisRepository;
  cloud: AnalysisRepository;
  /** Fila de envio por usuário (IndexedDB), para não misturar contas no mesmo aparelho. */
  outboxFor: (userId: string) => AnalysisRepository;
  auth: Pick<AuthService, 'currentUser'>;
  isOnline?: () => boolean;
  /** Registra o reenvio ao reconectar (padrão: evento `online` da janela). */
  onReconnect?: (flush: () => void) => void;
}

/**
 * Composição dos históricos:
 * - sem login → só o aparelho (LocalAnalysisRepository), exatamente como antes;
 * - com login → nuvem; sem internet, o envio entra numa fila local e sobe ao reconectar (id idempotente);
 * - demonstração e resultados simulados → sempre só no aparelho.
 */
export class SessionAwareAnalysisRepository implements AnalysisRepository, HistorySync {
  private readonly local: AnalysisRepository;
  private readonly cloud: AnalysisRepository;
  private readonly outboxFor: (userId: string) => AnalysisRepository;
  private readonly auth: Pick<AuthService, 'currentUser'>;
  private readonly isOnline: () => boolean;
  private readonly outboxes = new Map<string, AnalysisRepository>();
  private flushing?: Promise<void>;

  constructor(options: SessionAwareOptions) {
    this.local = options.local;
    this.cloud = options.cloud;
    this.outboxFor = options.outboxFor;
    this.auth = options.auth;
    this.isOnline = options.isOnline ?? (() => typeof navigator === 'undefined' || navigator.onLine);
    const onReconnect =
      options.onReconnect ??
      ((flush: () => void) => {
        if (typeof window !== 'undefined') window.addEventListener('online', flush);
      });
    onReconnect(() => void this.flush().catch(() => undefined));
  }

  private outbox(userId: string): AnalysisRepository {
    let box = this.outboxes.get(userId);
    if (!box) {
      box = this.outboxFor(userId);
      this.outboxes.set(userId, box);
    }
    return box;
  }

  private async userId(): Promise<string | null> {
    return (await this.auth.currentUser().catch(() => null))?.id ?? null;
  }

  async save(a: Analysis): Promise<Analysis> {
    if (isDemo(a)) return this.local.save(a);
    const userId = await this.userId();
    if (!userId) return this.local.save(a);
    if (!this.isOnline()) return this.outbox(userId).save(a);
    try {
      return await this.cloud.save(a);
    } catch (err) {
      if (err instanceof CloudRejectedError) throw err;
      // Rede caiu no meio do envio: fica na fila e sobe depois.
      return this.outbox(userId).save(a);
    }
  }

  /** Reenvia a fila do usuário logado. Recusas definitivas voltam para o aparelho, para não sumirem. */
  async flush(): Promise<void> {
    this.flushing ??= (async () => {
      const userId = await this.userId();
      if (!userId || !this.isOnline()) return;
      const box = this.outbox(userId);
      for (const a of (await box.list()).reverse()) {
        try {
          await this.cloud.save(a);
        } catch (err) {
          if (!(err instanceof CloudRejectedError)) return; // ainda sem rede: tenta no próximo `online`
          await this.local.save(a);
        }
        await box.remove(a.id);
      }
    })().finally(() => {
      this.flushing = undefined;
    });
    return this.flushing;
  }

  async list(filter?: { state?: DiagnosisState }): Promise<Analysis[]> {
    const userId = await this.userId();
    if (!userId) return this.local.list(filter);
    await this.flush().catch(() => undefined);
    const [pending, demos] = await Promise.all([
      this.outbox(userId).list(filter),
      this.local.list(filter).then((all) => all.filter(isDemo)),
    ]);
    let cloud: Analysis[] = [];
    try {
      cloud = await this.cloud.list(filter);
    } catch (err) {
      // Sem internet: mostra o que está no aparelho (fila e demonstrações) em vez de uma tela de erro.
      if (pending.length + demos.length === 0) throw err;
    }
    return mergeById(cloud, pending, demos);
  }

  async get(id: string): Promise<Analysis | null> {
    const userId = await this.userId();
    if (!userId) return this.local.get(id);
    const pending = await this.outbox(userId).get(id);
    if (pending) return pending;
    const local = await this.local.get(id);
    if (local && isDemo(local)) return local;
    return this.cloud.get(id);
  }

  async remove(id: string): Promise<void> {
    const userId = await this.userId();
    if (!userId) return this.local.remove(id);
    const box = this.outbox(userId);
    if (await box.get(id)) return box.remove(id);
    const local = await this.local.get(id);
    if (local && isDemo(local)) return this.local.remove(id);
    return this.cloud.remove(id);
  }

  /**
   * "Apagar dados deste aparelho": limpa o histórico local e a fila deste aparelho.
   * O histórico da conta só sai pela exclusão de cada análise ou da conta (edge function delete-account).
   */
  async clear(): Promise<void> {
    const userId = await this.userId();
    if (userId) await this.outbox(userId).clear();
    await this.local.clear();
  }

  async pendingLocal(): Promise<number> {
    if (!(await this.userId())) return 0;
    return (await this.local.list()).filter((a) => !isDemo(a)).length;
  }

  async uploadLocal(): Promise<number> {
    const userId = await this.userId();
    if (!userId) return 0;
    let sent = 0;
    for (const a of (await this.local.list()).filter((x) => !isDemo(x)).reverse()) {
      try {
        await this.save(a);
      } catch (err) {
        if (err instanceof CloudRejectedError) continue; // fica só no aparelho
        throw err;
      }
      await this.local.remove(a.id);
      sent += 1;
    }
    return sent;
  }
}
