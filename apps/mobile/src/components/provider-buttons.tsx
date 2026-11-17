import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { BRAND, SIGN_IN_PROVIDER_LABELS, signInErrorMessage, type AuthResponse, type SignInProvider } from "@koinonia/shared";
import { API_URL, api } from "@/lib/api";
import { space, useTheme } from "@/lib/theme";

const ICONS: Record<SignInProvider, React.ComponentProps<typeof Ionicons>["name"]> = { apple: "logo-apple", google: "logo-google", microsoft: "logo-microsoft" };

/**
 * "Continue with Apple / Google / Microsoft". Opens the provider in the system's secure sign-in
 * sheet; it comes back through the app's link (koinonia://auth) with a one-time code, which is
 * traded for a session. Needs a real build: Expo Go cannot receive the app's own link.
 */
export function ProviderButtons({
  providers,
  startBase,
  lastUsed,
  onSignedIn,
  onError,
}: {
  providers: SignInProvider[];
  startBase: string;
  lastUsed: string | null;
  onSignedIn: (auth: AuthResponse, method: SignInProvider, isNew: boolean) => void;
  onError: (message: string | null) => void;
}) {
  const { c } = useTheme();
  const [busy, setBusy] = useState<SignInProvider | null>(null);
  if (providers.length === 0) return null;

  // A computer's "localhost" means nothing to a phone: use the address the app already talks to.
  const base = /\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(startBase) ? API_URL.replace(/\/+$/, "") : startBase;
  const ordered = [...providers].sort((a, b) => Number(b === lastUsed) - Number(a === lastUsed));

  const go = async (provider: SignInProvider) => {
    setBusy(provider);
    onError(null);
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const result = await WebBrowser.openAuthSessionAsync(`${base}/v1/auth/oauth/${provider}/start?client=app&tz=${encodeURIComponent(tz)}`, `${BRAND.urlScheme}://auth`);
      if (result.type !== "success") return; // closed the sheet: nothing to say
      const back = new URL(result.url);
      const code = back.searchParams.get("code");
      const error = back.searchParams.get("error");
      if (error || !code) {
        onError(signInErrorMessage(error ?? "failed", provider));
        return;
      }
      onSignedIn(await api.auth.oauthExchange({ code }), provider, back.searchParams.get("new") === "1");
    } catch {
      onError(signInErrorMessage("failed", provider));
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={{ gap: space.sm }}>
      {ordered.map((p) => (
        <Pressable
          key={p}
          accessibilityRole="button"
          accessibilityLabel={`Continue with ${SIGN_IN_PROVIDER_LABELS[p]}${p === lastUsed ? ", used last time" : ""}`}
          disabled={busy !== null}
          onPress={() => void go(p)}
          style={({ pressed }) => ({ minHeight: 50, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.sm, borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: pressed ? c.surfaceAlt : c.surface, opacity: busy && busy !== p ? 0.5 : 1 })}
        >
          <Ionicons name={ICONS[p]} size={20} color={c.text} />
          <Text style={{ fontSize: 17, fontWeight: "600", color: c.text }}>{busy === p ? "Opening…" : `Continue with ${SIGN_IN_PROVIDER_LABELS[p]}`}</Text>
          {p === lastUsed ? <Text style={{ fontSize: 12, fontWeight: "700", color: c.textMuted, backgroundColor: c.surfaceAlt, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, overflow: "hidden" }}>Used last time</Text> : null}
        </Pressable>
      ))}
    </View>
  );
}
