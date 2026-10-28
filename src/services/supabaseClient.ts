import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../data/supabase.types';

export type GreenLeafSupabase = SupabaseClient<Database>;

/**
 * Cliente do Supabase do app (projeto greenleaf-app — não é o projeto de logs da IA).
 * Só recebe a chave anônima/publicável: a RLS decide o que cada usuário pode ver.
 * A sessão fica no localStorage com prefixo `gl.`, então "Apagar dados deste aparelho" também a remove.
 */
export function createSupabase(url: string, anonKey: string): GreenLeafSupabase {
  return createClient<Database>(url, anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'gl.supabase.auth' },
  });
}
