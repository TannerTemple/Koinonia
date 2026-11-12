import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { AuthResponse, User } from "@koinonia/shared";
import { api, onUnauthorized, tokenStore } from "./api";
import { clearReminders } from "./notifications";

interface AuthState {
  /** undefined while the stored token is being checked */
  user: User | null | undefined;
  signIn: (auth: AuthResponse) => Promise<void>;
  signOut: () => Promise<void>;
  setUser: (user: User) => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const queryClient = useQueryClient();

  const clear = useCallback(async () => {
    await tokenStore.set(null);
    setUser(null);
    queryClient.clear();
    void clearReminders();
  }, [queryClient]);

  useEffect(() => {
    onUnauthorized(() => void clear());
    (async () => {
      if (!(await tokenStore.get())) return setUser(null);
      try {
        setUser(await api.me.get());
      } catch {
        // Offline at launch: stay signed out of the UI but keep the token for next time.
        setUser(null);
      }
    })();
  }, [clear]);

  const value = useMemo<AuthState>(
    () => ({
      user,
      setUser,
      signIn: async (auth) => {
        await tokenStore.set(auth.token);
        queryClient.clear();
        setUser(auth.user);
      },
      signOut: async () => {
        await api.auth.logout().catch(() => undefined);
        await clear();
      },
    }),
    [user, queryClient, clear],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

export function useUser(): User {
  const { user } = useAuth();
  if (!user) throw new Error("No signed-in user");
  return user;
}
