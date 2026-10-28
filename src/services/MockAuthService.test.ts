import { describe, expect, it } from 'vitest';
import { AuthError } from '../domain/errors';
import { MockAuthService } from './MockAuthService';

async function kind(p: Promise<unknown>) {
  try {
    await p;
    return 'ok';
  } catch (e) {
    return e instanceof AuthError ? e.kind : 'other';
  }
}

describe('MockAuthService', () => {
  it('cadastra, mantém sessão, sai e entra de novo', async () => {
    const auth = new MockAuthService(localStorage);
    const u = await auth.signUp('Maria Souza', 'Maria@Exemplo.com', 'senha-segura');
    expect(u.email).toBe('maria@exemplo.com');
    expect(await auth.currentUser()).toEqual(u);
    await auth.signOut();
    expect(await auth.currentUser()).toBeNull();
    expect((await auth.signIn('maria@exemplo.com', 'senha-segura')).id).toBe(u.id);
  });

  it('nunca guarda a senha em texto', async () => {
    const auth = new MockAuthService(localStorage);
    await auth.signUp('Ana', 'ana@exemplo.com', 'minha-senha-123');
    expect(JSON.stringify(localStorage)).not.toContain('minha-senha-123');
  });

  it('valida entradas e não revela se o e-mail existe', async () => {
    const auth = new MockAuthService(localStorage);
    expect(await kind(auth.signUp('A', 'a@b.com', '12345678'))).toBe('invalid_name');
    expect(await kind(auth.signUp('Ana', 'sem-arroba', '12345678'))).toBe('invalid_email');
    expect(await kind(auth.signUp('Ana', 'a@b.com', 'curta'))).toBe('weak_password');
    await auth.signUp('Ana', 'a@b.com', '12345678');
    expect(await kind(auth.signUp('Outra', 'A@B.com', '12345678'))).toBe('email_taken');
    expect(await kind(auth.signIn('a@b.com', 'errada!!'))).toBe('invalid_credentials');
    expect(await kind(auth.signIn('nao@existe.com', '12345678'))).toBe('invalid_credentials');
  });

  it('excluir conta remove o usuário', async () => {
    const auth = new MockAuthService(localStorage);
    await auth.signUp('Ana', 'a@b.com', '12345678');
    await auth.deleteAccount();
    expect(await auth.currentUser()).toBeNull();
    expect(await kind(auth.signIn('a@b.com', '12345678'))).toBe('invalid_credentials');
    expect(await kind(auth.deleteAccount())).toBe('not_signed_in');
  });
});
