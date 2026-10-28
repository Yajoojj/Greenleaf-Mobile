import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { User } from '../domain/types';
import { useServices } from './services';

interface AuthValue {
  user: User | null;
  ready: boolean;
  signIn: (email: string, password: string) => Promise<User>;
  signUp: (name: string, email: string, password: string) => Promise<User>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { auth } = useServices();
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    auth.currentUser().then((u) => {
      if (alive) {
        setUser(u);
        setReady(true);
      }
    }, () => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, [auth]);

  const signIn = useCallback(async (email: string, password: string) => {
    const u = await auth.signIn(email, password);
    setUser(u);
    return u;
  }, [auth]);

  const signUp = useCallback(async (name: string, email: string, password: string) => {
    const u = await auth.signUp(name, email, password);
    setUser(u);
    return u;
  }, [auth]);

  const signOut = useCallback(async () => {
    await auth.signOut();
    setUser(null);
  }, [auth]);

  const deleteAccount = useCallback(async () => {
    await auth.deleteAccount();
    setUser(null);
  }, [auth]);

  const value = useMemo(() => ({ user, ready, signIn, signUp, signOut, deleteAccount }), [user, ready, signIn, signUp, signOut, deleteAccount]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth fora do AuthProvider');
  return ctx;
}
