import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { setAuthTokenGetter } from '@workspace/api-client-react';
import { supabase } from '@/lib/supabase';
import type { Session, User } from '@supabase/supabase-js';

interface AuthContextValue {
  token: string | null;
  userId: string | null;
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  signIn: (token: string, userId: string) => Promise<void>;
  setSession: (session: Session | null) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  token: null,
  userId: null,
  user: null,
  session: null,
  isLoading: true,
  signIn: async () => {},
  setSession: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [session, setSessionState] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const getDynamicToken = useCallback(async (): Promise<string | null> => {
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      return currentSession?.access_token ?? null;
    } catch {
      return null;
    }
  }, []);

  // Restore initial Supabase session from localStorage
  useEffect(() => {
    let mounted = true;

    async function restoreSession() {
      try {
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();
        if (error) {
          console.warn('[SupabaseAuth Web] getSession error:', error.message);
        }

        if (mounted && initialSession) {
          const accessToken = initialSession.access_token;
          setSessionState(initialSession);
          setUser(initialSession.user);
          setToken(accessToken);
          setUserId(initialSession.user.id);
          setAuthTokenGetter(getDynamicToken);
        } else if (mounted) {
          setAuthTokenGetter(null);
        }
      } catch (err) {
        console.warn('[SupabaseAuth Web] restoreSession exception:', err);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    restoreSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      if (!mounted) return;

      if (currentSession) {
        const accessToken = currentSession.access_token;
        setSessionState(currentSession);
        setUser(currentSession.user);
        setToken(accessToken);
        setUserId(currentSession.user.id);
        setAuthTokenGetter(getDynamicToken);
      } else {
        setSessionState(null);
        setUser(null);
        setToken(null);
        setUserId(null);
        setAuthTokenGetter(null);
      }
      setIsLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [getDynamicToken]);

  const setSession = useCallback(async (newSession: Session | null) => {
    if (newSession) {
      const accessToken = newSession.access_token;
      setSessionState(newSession);
      setUser(newSession.user);
      setToken(accessToken);
      setUserId(newSession.user.id);
      setAuthTokenGetter(getDynamicToken);
    } else {
      setSessionState(null);
      setUser(null);
      setToken(null);
      setUserId(null);
      setAuthTokenGetter(null);
    }
  }, [getDynamicToken]);

  const signIn = useCallback(async (newToken: string, newUserId: string) => {
    setToken(newToken);
    setUserId(newUserId);
    setAuthTokenGetter(getDynamicToken);
  }, [getDynamicToken]);

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore
    }
    setSessionState(null);
    setUser(null);
    setToken(null);
    setUserId(null);
    setAuthTokenGetter(null);
  }, []);

  return (
    <AuthContext.Provider value={{ token, userId, user, session, isLoading, signIn, setSession, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
