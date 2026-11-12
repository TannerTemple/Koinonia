import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Body, Button, Field, FormError, Screen, Title, fieldErrors } from "@/components/ui";
import { api } from "@/lib/api";

/** Reached from the email's code (pasted) or a koinonia://reset-password?token= link. */
export default function ResetPasswordScreen() {
  const params = useLocalSearchParams<{ token?: string }>();
  const [token, setToken] = useState(params.token ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const errors = fieldErrors(error);

  const submit = async () => {
    setLoading(true);
    setError(null);
    try {
      await api.auth.resetPassword({ token: token.trim(), password });
      setDone(true);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <Screen>
        <Title>Password changed</Title>
        <Body muted>You&rsquo;ve been signed out everywhere. Sign in with your new password.</Body>
        <Button label="Sign in" onPress={() => router.dismissTo("/login")} />
      </Screen>
    );
  }

  return (
    <Screen keyboard>
      <Body muted>Paste the code from your reset email, then choose a new password.</Body>
      <Field label="Reset code" value={token} onChangeText={setToken} error={errors.token} autoCapitalize="none" autoCorrect={false} />
      <Field label="New password" hint="At least 8 characters." value={password} onChangeText={setPassword} error={errors.password} secureTextEntry textContentType="newPassword" autoComplete="new-password" />
      <FormError error={error} />
      <Button label="Save new password" loading={loading} disabled={token.trim().length < 20 || password.length < 8} onPress={submit} />
    </Screen>
  );
}
