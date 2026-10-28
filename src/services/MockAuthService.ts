import { AuthError } from '../domain/errors';
import type { AuthService } from '../domain/services';
import type { User } from '../domain/types';

interface StoredUser extends User {
  salt: string;
  hash: string;
}

const USERS_KEY = 'gl.mock.users';
const SESSION_KEY = 'gl.mock.session';
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function toHex(buf: ArrayBuffer | Uint8Array): string {
  return Array.from(buf instanceof Uint8Array ? buf : new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function hashPassword(password: string, saltHex: string): Promise<string> {
  const salt = new Uint8Array(saltHex.match(/../g)!.map((h) => parseInt(h, 16)));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' }, key, 256);
  return toHex(bits);
}

/**
 * Contas simuladas, guardadas só neste navegador. Mesmo sendo mock, a senha nunca é
 * guardada em texto: vai como PBKDF2-SHA-256 com sal. Será trocado pelo Supabase Auth.
 */
export class MockAuthService implements AuthService {
  constructor(private readonly storage: Storage = localStorage) {}

  private users(): StoredUser[] {
    try {
      const parsed = JSON.parse(this.storage.getItem(USERS_KEY) ?? '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private saveUsers(users: StoredUser[]): void {
    this.storage.setItem(USERS_KEY, JSON.stringify(users));
  }

  private static publicUser({ id, name, email, createdAt }: StoredUser): User {
    return { id, name, email, createdAt };
  }

  async signUp(name: string, email: string, password: string): Promise<User> {
    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();
    if (cleanName.length < 2 || cleanName.length > 80) throw new AuthError('invalid_name');
    if (!EMAIL.test(cleanEmail)) throw new AuthError('invalid_email');
    if (password.length < 8) throw new AuthError('weak_password');
    const users = this.users();
    if (users.some((u) => u.email === cleanEmail)) throw new AuthError('email_taken');
    const salt = toHex(crypto.getRandomValues(new Uint8Array(16)));
    const user: StoredUser = {
      id: crypto.randomUUID(),
      name: cleanName,
      email: cleanEmail,
      createdAt: new Date().toISOString(),
      salt,
      hash: await hashPassword(password, salt),
    };
    this.saveUsers([...users, user]);
    this.storage.setItem(SESSION_KEY, user.id);
    return MockAuthService.publicUser(user);
  }

  async signIn(email: string, password: string): Promise<User> {
    const user = this.users().find((u) => u.email === email.trim().toLowerCase());
    // Mesma mensagem para e-mail inexistente e senha errada (não revela contas).
    if (!user || (await hashPassword(password, user.salt)) !== user.hash) throw new AuthError('invalid_credentials');
    this.storage.setItem(SESSION_KEY, user.id);
    return MockAuthService.publicUser(user);
  }

  async signOut(): Promise<void> {
    this.storage.removeItem(SESSION_KEY);
  }

  async currentUser(): Promise<User | null> {
    const id = this.storage.getItem(SESSION_KEY);
    const user = id ? this.users().find((u) => u.id === id) : undefined;
    return user ? MockAuthService.publicUser(user) : null;
  }

  async deleteAccount(): Promise<void> {
    const id = this.storage.getItem(SESSION_KEY);
    if (!id) throw new AuthError('not_signed_in');
    this.saveUsers(this.users().filter((u) => u.id !== id));
    this.storage.removeItem(SESSION_KEY);
  }
}
