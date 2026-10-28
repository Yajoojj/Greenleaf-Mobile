import { describe, expect, it } from 'vitest';
import { AuthError } from '../domain/errors';
import { fakeSupabase } from '../test/fakeSupabase';
import { SupabaseAuthService } from './SupabaseAuthService';

const supaUser = { id: 'u1', email: 'ana@exemplo.com', created_at: '2026-10-01T00:00:00Z', user_metadata: { name: 'Ana' }, identities: [{}] };

async function kindOf(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return 'ok';
  } catch (err) {
    return err instanceof AuthError ? err.kind : 'other';
  }
}

describe('SupabaseAuthService', () => {
  it('valida nome, e-mail e senha antes de chamar o Supabase (mesmas regras do mock)', async () => {
    const f = fakeSupabase();
    const auth = new SupabaseAuthService(f.client);
    expect(await kindOf(auth.signUp('A', 'ana@exemplo.com', '12345678'))).toBe('invalid_name');
    expect(await kindOf(auth.signUp('Ana', 'ana@', '12345678'))).toBe('invalid_email');
    expect(await kindOf(auth.signUp('Ana', 'ana@exemplo.com', '1234567'))).toBe('weak_password');
    expect(f.auth.signUp).not.toHaveBeenCalled();
  });

  it('cadastro envia o nome nos metadados (o trigger cria o perfil) e devolve o usuário', async () => {
    const f = fakeSupabase();
    f.auth.signUp.mockResolvedValue({ data: { user: supaUser, session: { user: supaUser } }, error: null });
    const user = await new SupabaseAuthService(f.client, 'https://app.test').signUp(' Ana ', 'ANA@exemplo.com', '12345678');
    expect(user).toEqual({ id: 'u1', name: 'Ana', email: 'ana@exemplo.com', createdAt: '2026-10-01T00:00:00Z' });
    expect(f.auth.signUp).toHaveBeenCalledWith({
      email: 'ana@exemplo.com',
      password: '12345678',
      options: { data: { name: 'Ana' }, emailRedirectTo: 'https://app.test' },
    });
  });

  it('mapeia os erros do Supabase para os AuthError das telas', async () => {
    const f = fakeSupabase();
    const auth = new SupabaseAuthService(f.client);
    const cases: [string, string][] = [
      ['user_already_exists', 'email_taken'],
      ['email_exists', 'email_taken'],
      ['weak_password', 'weak_password'],
      ['email_address_invalid', 'invalid_email'],
    ];
    for (const [code, kind] of cases) {
      f.auth.signUp.mockResolvedValueOnce({ data: { user: null, session: null }, error: { code, status: 422, message: code } });
      expect(await kindOf(auth.signUp('Ana', 'ana@exemplo.com', '12345678'))).toBe(kind);
    }
  });

  it('com confirmação de e-mail ligada, o cadastro pede para confirmar; e-mail repetido vira email_taken', async () => {
    const f = fakeSupabase();
    const auth = new SupabaseAuthService(f.client);
    f.auth.signUp.mockResolvedValueOnce({ data: { user: supaUser, session: null }, error: null });
    expect(await kindOf(auth.signUp('Ana', 'ana@exemplo.com', '12345678'))).toBe('confirm_email');
    f.auth.signUp.mockResolvedValueOnce({ data: { user: { ...supaUser, identities: [] }, session: null }, error: null });
    expect(await kindOf(auth.signUp('Ana', 'ana@exemplo.com', '12345678'))).toBe('email_taken');
  });

  it('mesma mensagem para e-mail inexistente e senha errada', async () => {
    const f = fakeSupabase();
    const auth = new SupabaseAuthService(f.client);
    f.auth.signInWithPassword.mockResolvedValueOnce({ data: { user: null }, error: { code: 'invalid_credentials', status: 400 } });
    expect(await kindOf(auth.signIn('ninguem@exemplo.com', 'x'))).toBe('invalid_credentials');
    f.auth.signInWithPassword.mockResolvedValueOnce({ data: { user: null }, error: { status: 400 } });
    expect(await kindOf(auth.signIn('ana@exemplo.com', 'errada'))).toBe('invalid_credentials');
    f.auth.signInWithPassword.mockResolvedValueOnce({ data: { user: null }, error: { code: 'email_not_confirmed', status: 400 } });
    expect(await kindOf(auth.signIn('ana@exemplo.com', '12345678'))).toBe('confirm_email');
  });

  it('currentUser lê a sessão guardada; signOut é só neste aparelho', async () => {
    const f = fakeSupabase();
    const auth = new SupabaseAuthService(f.client);
    expect((await auth.currentUser())?.name).toBe('Ana');
    await auth.signOut();
    expect(f.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(await new SupabaseAuthService(fakeSupabase({ session: null }).client).currentUser()).toBeNull();
  });

  it('deleteAccount chama a edge function (sem service role no app) e encerra a sessão', async () => {
    const f = fakeSupabase();
    await new SupabaseAuthService(f.client).deleteAccount();
    expect(f.functions.invoke).toHaveBeenCalledWith('delete-account', { method: 'POST' });
    expect(f.auth.signOut).toHaveBeenCalled();
    expect(await kindOf(new SupabaseAuthService(fakeSupabase({ session: null }).client).deleteAccount())).toBe('not_signed_in');
  });

  it('falha na edge function não encerra a sessão', async () => {
    const f = fakeSupabase();
    f.functions.invoke.mockResolvedValueOnce({ data: { deleted: false }, error: new Error('500') });
    await expect(new SupabaseAuthService(f.client).deleteAccount()).rejects.toThrow();
    expect(f.auth.signOut).not.toHaveBeenCalled();
  });
});
