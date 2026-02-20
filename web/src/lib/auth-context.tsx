"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { getMe, type User } from "./api";
import { getToken, setToken, clearToken } from "./auth";

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isLoggedIn: boolean;
  login: (token: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  isLoading: true,
  isLoggedIn: false,
  login: async () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = getToken();
    if (stored) {
      setTokenState(stored);
      getMe(stored)
        .then(setUser)
        .catch(() => {
          clearToken();
          setTokenState(null);
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = async (newToken: string) => {
    setToken(newToken);
    setTokenState(newToken);
    const me = await getMe(newToken);
    setUser(me);
  };

  const logout = () => {
    clearToken();
    setTokenState(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isLoggedIn: !!user,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
