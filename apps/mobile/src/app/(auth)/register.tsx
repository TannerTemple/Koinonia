import { useEffect, useState } from "react";
import { Text } from "react-native";
import type { PublicConfig } from "@koinonia/shared";
import { ProviderButtons } from "@/components/provider-buttons";
import { useTheme } from "@/lib/theme";
import { Button, Field, FormError, Screen, fieldErrors, LegalLinks } from "@/components/ui";
import { WEB_URL, api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function RegisterScreen() {
  const { signIn } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const errors = fieldErrors(error);

  const submit = async () => {
    setLoading(true);
    setError(null);
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      await signIn(await api.auth.register({ name, email, password, timezone }));
    } catch (err) {
      setError(err);
      setLoading(false);
    }
  };

  const { c } = useTheme();
  // Google, Microsoft or Apple, when the person running the service has switched them on.
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [outsideError, setOutsideError] = useState<string | null>(null);
  useEffect(() => {
    void api.config().then(setConfig, () => undefined);
  }, []);

  return (
    <Screen keyboard>
      {config && config.signIn.providers.length > 0 ? (
        <>
          <ProviderButtons providers={config.signIn.providers} startBase={config.signIn.startBase} lastUsed={null} onError={setOutsideError} onSignedIn={(auth, method) => void signIn(auth, method)} />
          {outsideError ? <Text accessibilityRole="alert" style={{ fontSize: 15, color: c.danger }}>{outsideError}</Text> : null}
          <Text style={{ textAlign: "center", fontSize: 14, color: c.textMuted }}>or with your email</Text>
        </>
      ) : null}
      <Field label="Your name" value={name} onChangeText={setName} error={errors.name} textContentType="name" autoComplete="name" maxLength={80} />
      <Field label="Email" value={email} onChangeText={setEmail} error={errors.email} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" textContentType="username" autoComplete="email" />
      <Field label="Password" hint="At least 8 characters." value={password} onChangeText={setPassword} error={errors.password} secureTextEntry textContentType="newPassword" autoComplete="new-password" />
      <FormError error={error} />
      <Button label="Create account" loading={loading} disabled={!name || !email || password.length < 8} onPress={submit} />
      <LegalLinks webUrl={WEB_URL} prefix="By creating an account you agree to the" />
    </Screen>
  );
}
