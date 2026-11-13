"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { AuthResponse, User } from "@koinonia/shared";
import { api, dropLegacyToken, onUnauthorized } from "./api";

interface AuthState {
  /** undefined while we check the stored token */
  user: User | null | undefined;
  signIn: (auth: AuthResponse) => void;
  signOut: () => Promise<void>;
  setUser: (user: User) => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const queryClient = useQueryClient();
  const router = useRouter();

  const clear = useCallback(() => {
    setUser(null);
    queryClient.clear();
  }, [queryClient]);

  useEffect(() => {
    onUnauthorized(clear);
    dropLegacyToken();
    // The cookie can't be read from here, so ask the API who we are.
    api.me.get().then(setUser, () => clear());
  }, [clear]);

  const value = useMemo<AuthState>(
    () => ({
      user,
      setUser,
      signIn: (auth) => {
        queryClient.clear();
        setUser(auth.user);
        router.replace("/");
      },
      signOut: async () => {
        await api.auth.logout().catch(() => undefined);
        clear();
        router.replace("/login");
      },
    }),
    [user, queryClient, router, clear],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

/** The signed-in user. Only call inside the (app) layout, which guarantees one. */
export function useUser(): User {
  const { user } = useAuth();
  if (!user) throw new Error("No signed-in user");
  return user;
}
