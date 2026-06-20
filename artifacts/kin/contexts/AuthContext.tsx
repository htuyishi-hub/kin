import AsyncStorage from "@react-native-async-storage/async-storage";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

const TOKEN_KEY = "@kin:token";
const USER_ID_KEY = "@kin:userId";

interface AuthContextValue {
  token: string | null;
  userId: string | null;
  isLoading: boolean;
  signIn: (token: string, userId: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  token: null,
  userId: null,
  isLoading: true,
  signIn: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function restore() {
      try {
        const [t, u] = await Promise.all([
          AsyncStorage.getItem(TOKEN_KEY),
          AsyncStorage.getItem(USER_ID_KEY),
        ]);
        if (t && u) {
          setToken(t);
          setUserId(u);
          setAuthTokenGetter(() => t);
        }
      } catch {
        // ignore
      } finally {
        setIsLoading(false);
      }
    }
    restore();
  }, []);

  const signIn = useCallback(async (newToken: string, newUserId: string) => {
    await Promise.all([
      AsyncStorage.setItem(TOKEN_KEY, newToken),
      AsyncStorage.setItem(USER_ID_KEY, newUserId),
    ]);
    setToken(newToken);
    setUserId(newUserId);
    setAuthTokenGetter(() => newToken);
  }, []);

  const signOut = useCallback(async () => {
    await Promise.all([
      AsyncStorage.removeItem(TOKEN_KEY),
      AsyncStorage.removeItem(USER_ID_KEY),
    ]);
    setToken(null);
    setUserId(null);
    setAuthTokenGetter(null);
  }, []);

  return (
    <AuthContext.Provider value={{ token, userId, isLoading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
