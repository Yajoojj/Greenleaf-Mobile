import type { AnalysisRepository } from '../domain/services';
import type { Analysis, DiagnosisState } from '../domain/types';

const DB_NAME = 'greenleaf';
const DB_VERSION = 1;
const STORE = 'analyses';

function promisify<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Histórico no próprio aparelho (IndexedDB) — disponível sem internet. */
export class LocalAnalysisRepository implements AnalysisRepository {
  private db?: Promise<IDBDatabase>;

  constructor(private readonly factory: IDBFactory = indexedDB, private readonly name = DB_NAME) {}

  private open(): Promise<IDBDatabase> {
    this.db ??= new Promise((resolve, reject) => {
      const req = this.factory.open(this.name, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: 'id' });
          store.createIndex('createdAt', 'createdAt');
          store.createIndex('state', 'state');
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return this.db;
  }

  private async store(mode: IDBTransactionMode): Promise<IDBObjectStore> {
    return (await this.open()).transaction(STORE, mode).objectStore(STORE);
  }

  async save(a: Analysis): Promise<Analysis> {
    await promisify((await this.store('readwrite')).put(a));
    return a;
  }

  async list(filter?: { state?: DiagnosisState }): Promise<Analysis[]> {
    const store = await this.store('readonly');
    const rows = filter?.state
      ? await promisify(store.index('state').getAll(filter.state) as IDBRequest<Analysis[]>)
      : await promisify(store.getAll() as IDBRequest<Analysis[]>);
    return rows.sort((x, y) => y.createdAt.localeCompare(x.createdAt));
  }

  async get(id: string): Promise<Analysis | null> {
    const row = await promisify((await this.store('readonly')).get(id) as IDBRequest<Analysis | undefined>);
    return row ?? null;
  }

  async remove(id: string): Promise<void> {
    await promisify((await this.store('readwrite')).delete(id));
  }

  async clear(): Promise<void> {
    await promisify((await this.store('readwrite')).clear());
  }
}
