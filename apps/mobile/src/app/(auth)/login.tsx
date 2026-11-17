import { LinearGradient } from "expo-linear-gradient";
import { Link } from "expo-router";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, Field, FormError, fieldErrors } from "@/components/ui";
import { LAST_SIGN_IN_KEY, maskEmail, readLastSignIn, type LastSignIn } from "@koinonia/shared";
import { api } from "@/lib/api";
import { kv } from "@/lib/storage";
import { useAuth } from "@/lib/auth";
import { serif, space, useTheme } from "@/lib/theme";

export default function LoginScreen() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const errors = fieldErrors(error);
  // Who signed in on this phone last time, so coming back is one field instead of two.
  const [last, setLast] = useState<LastSignIn | null>(null);
  useEffect(() => {
    void kv.get(LAST_SIGN_IN_KEY).then((text) => {
      const found = readLastSignIn(text);
      if (found) {
        setLast(found);
        setEmail((current) => current || found.email);
      }
    });
  }, []);
  const forget = () => {
    void kv.remove(LAST_SIGN_IN_KEY);
    setLast(null);
    setEmail("");
  };

  const submit = async () => {
    setLoading(true);
    setError(null);
    try {
      await signIn(await api.auth.login({ email, password }));
    } catch (err) {
      setError(err);
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }}>
        <LinearGradient colors={["#2A4590", "#1B2F66", "#131F47"]} start={{ x: 0.9, y: 0 }} end={{ x: 0.2, y: 1 }} style={{ paddingTop: insets.top + space.xxl, padding: space.xl, gap: space.sm }}>
          <Text style={{ color: c.onHeroMuted, fontSize: 12, fontWeight: "800", letterSpacing: 1.6 }}>ΚΟΙΝΩΝΙΑ · COMMUNION, FELLOWSHIP</Text>
          <Text accessibilityRole="header" style={{ fontFamily: serif, color: c.onHero, fontSize: 40, fontWeight: "700" }}>
            Koinonia
          </Text>
          <Text style={{ color: c.onHeroMuted, fontSize: 18, lineHeight: 25 }}>Stay close to the people you mean to stay close to.</Text>
        </LinearGradient>
        <View style={{ padding: space.xl, gap: space.lg }}>
          {last ? (
            <View style={{ gap: 6 }}>
              <Text accessibilityRole="header" style={{ fontFamily: serif, fontSize: 26, fontWeight: "700", color: c.text }}>
                Welcome back{last.firstName ? `, ${last.firstName}` : ""}
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space.sm }}>
                <Text style={{ fontSize: 13, fontWeight: "700", color: c.text, backgroundColor: c.surfaceAlt, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, overflow: "hidden" }}>Used last time</Text>
                <Text style={{ fontSize: 15, color: c.textMuted }}>{maskEmail(last.email)}</Text>
                <Text accessibilityRole="button" onPress={forget} style={{ fontSize: 15, fontWeight: "700", color: c.primary, paddingVertical: 6 }}>
                  Not you?
                </Text>
              </View>
            </View>
          ) : null}
          <Field label="Email" value={email} onChangeText={setEmail} error={errors.email} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" textContentType="username" autoComplete="email" returnKeyType="next" />
          <Field label="Password" value={password} onChangeText={setPassword} error={errors.password} secureTextEntry textContentType="password" autoComplete="current-password" returnKeyType="go" onSubmitEditing={submit} />
          <FormError error={error} />
          <Button label="Sign in" loading={loading} disabled={!email || !password} onPress={submit} />
          <Link href="/forgot-password" style={{ color: c.primary, fontWeight: "700", fontSize: 15, textAlign: "center", padding: space.sm }}>
            Forgot password?
          </Link>
          <Link href="/register" style={{ color: c.primary, fontWeight: "700", fontSize: 16, textAlign: "center", padding: space.sm }}>
            New here? Create an account
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
