import { LinearGradient } from "expo-linear-gradient";
import { Link } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, Field, FormError, fieldErrors } from "@/components/ui";
import { api } from "@/lib/api";
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
