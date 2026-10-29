import type { User as SupabaseUser } from '@supabase/supabase-js';
import { AuthError, type AuthErrorKind } from '../domain/errors';
import type { AuthService } from '../domain/services';
import type { User } from '../domain/types';
import type { GreenLeafSupabase } from './supabaseClient';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Códigos do Supabase Auth → erros que as telas já sabem explicar. */
const CODE_TO_KIND: Record<string, AuthErrorKind> = {
  invalid_credentials: 'invalid_credentials',
  user_already_exists: 'email_taken',
  email_exists: 'email_taken',
  weak_password: 'weak_password',
  email_address_invalid: 'invalid_email',
  validation_failed: 'invalid_email',
  email_not_confirmed: 'confirm_email',
};

function toUser(u: SupabaseUser): User {
  const name = typeof u.user_metadata?.name === 'string' ? u.user_metadata.name : (u.email ?? '').split('@')[0];
  return { id: u.id, name, email: u.email ?? '', createdAt: u.created_at };
}

/**
 * Converte o erro do Supabase. No login, qualquer recusa da API vira `invalid_credentials`:
 * mesma mensagem para e-mail inexistente e senha errada. Falha de rede segue como está (mensagem genérica).
 */
function mapError(error: { code?: string; status?: number }, op: 'signIn' | 'signUp'): Error {
  const kind = error.code ? CODE_TO_KIND[error.code] : undefined;
  if (kind) return new AuthError(kind);
  if (op === 'signIn' && error.status === 400) return new AuthError('invalid_credentials');
  return error instanceof Error ? error : new Error('auth_failed');
}

/** Contas no Supabase Auth (e-mail e senha, confirmação por e-mail). */
export class SupabaseAuthService implements AuthService {
  constructor(private readonly client: GreenLeafSupabase, private readonly redirectTo?: string) {}

  async signUp(name: string, email: string, password: string): Promise<User> {
    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();
    // Mesmas regras do mock (e do banco: profiles.name tem 2–80 caracteres).
    if (cleanName.length < 2 || cleanName.length > 80) throw new AuthError('invalid_name');
    if (!EMAIL.test(cleanEmail)) throw new AuthError('invalid_email');
    if (password.length < 8) throw new AuthError('weak_password');

    const { data, error } = await this.client.auth.signUp({
      email: cleanEmail,
      password,
      options: { data: { name: cleanName }, emailRedirectTo: this.redirectTo },
    });
    if (error) throw mapError(error, 'signUp');
    // Com confirmação ligada, e-mail repetido volta como usuário sem identidades.
    if (!data.user || data.user.identities?.length === 0) throw new AuthError('email_taken');
    if (!data.session) throw new AuthError('confirm_email');
    return toUser(data.user);
  }

  async signIn(email: string, password: string): Promise<User> {
    const { data, error } = await this.client.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (error) throw mapError(error, 'signIn');
    return toUser(data.user);
  }

  async signOut(): Promise<void> {
    // Só neste aparelho; outros aparelhos continuam conectados.
    await this.client.auth.signOut({ scope: 'local' });
  }

  async currentUser(): Promise<User | null> {
    // getSession lê a sessão guardada (funciona sem internet).
    const { data } = await this.client.auth.getSession();
    return data.session ? toUser(data.session.user) : null;
  }

  /** A exclusão roda na edge function `delete-account`: a chave service role nunca vem para o app. */
  async deleteAccount(): Promise<void> {
    const { data } = await this.client.auth.getSession();
    if (!data.session) throw new AuthError('not_signed_in');
    const { error } = await this.client.functions.invoke('delete-account', { method: 'POST' });
    if (error) throw error;
    await this.client.auth.signOut({ scope: 'local' }).catch(() => undefined);
  }
}
