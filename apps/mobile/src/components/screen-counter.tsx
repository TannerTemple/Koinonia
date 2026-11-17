import { usePathname } from "expo-router";
import { useEffect } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

/**
 * Tells the server which screen was opened, as a pattern with no ids in it, so the admin page
 * can show which screens get used. A count only: nothing about what is on the screen.
 */
export function ScreenCounter() {
  const pathname = usePathname();
  const { user } = useAuth();
  const signedIn = Boolean(user);
  useEffect(() => {
    if (signedIn && pathname) void api.usage.screens("app", [pathname]).catch(() => undefined);
  }, [pathname, signedIn]);
  return null;
}
