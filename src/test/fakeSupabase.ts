import { vi } from 'vitest';
import type { GreenLeafSupabase } from '../services/supabaseClient';

type Result = { data?: unknown; error?: unknown };

/** Registro de cada chamada encadeada: from('t').select(...).eq(...) vira [{ table, ops }]. */
export interface QueryCall {
  table: string;
  ops: { op: string; args: unknown[] }[];
}

/**
 * Cliente Supabase de mentira para testes de unidade: sem rede.
 * `respond(table, ops)` decide o resultado de cada consulta.
 */
export function fakeSupabase({
  session = { user: { id: 'user-1', email: 'ana@exemplo.com', created_at: '2026-10-01T00:00:00Z', user_metadata: { name: 'Ana' } } } as unknown,
  respond = (() => ({ data: null, error: null })) as (call: QueryCall) => Result,
} = {}) {
  const calls: QueryCall[] = [];
  const storage = {
    upload: vi.fn(async (_path: string, _blob: Blob, _opts?: unknown) => ({ data: { path: _path }, error: null as unknown })),
    createSignedUrls: vi.fn(async (paths: string[], _ttl: number) => ({
      data: paths.map((p) => ({ path: p, signedUrl: `https://x.supabase.co/storage/v1/object/sign/leaves/${p}?token=t`, error: null })),
      error: null as unknown,
    })),
    remove: vi.fn(async (paths: string[]) => ({ data: paths.map((name) => ({ name })), error: null as unknown })),
  };
  const auth = {
    getSession: vi.fn(async () => ({ data: { session }, error: null })),
    signUp: vi.fn(),
    signInWithPassword: vi.fn(),
    signOut: vi.fn(async () => ({ error: null })),
  };
  const functions = { invoke: vi.fn(async () => ({ data: { deleted: true }, error: null as unknown })) };
  const rpc = vi.fn(async () => ({ data: [] as unknown[], error: null as unknown }));

  function from(table: string) {
    const call: QueryCall = { table, ops: [] };
    calls.push(call);
    const builder: Record<string, unknown> = {};
    for (const op of ['select', 'insert', 'upsert', 'delete', 'eq', 'order', 'maybeSingle']) {
      builder[op] = (...args: unknown[]) => {
        call.ops.push({ op, args });
        return builder;
      };
    }
    builder.then = (resolve: (r: Result) => unknown, reject: (e: unknown) => unknown) => Promise.resolve(respond(call)).then(resolve, reject);
    return builder;
  }

  const client = { auth, functions, rpc, from: vi.fn(from), storage: { from: vi.fn(() => storage) } };
  return { client: client as unknown as GreenLeafSupabase, auth, functions, rpc, storage, calls };
}

export const op = (call: QueryCall, name: string) => call.ops.find((o) => o.op === name);
