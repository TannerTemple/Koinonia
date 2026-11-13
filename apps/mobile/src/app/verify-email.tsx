import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Body, Button, Field, FormError, Screen, fieldErrors } from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

/** Confirm your email with the code from the email (pasted) or a koinonia://verify-email?token= link. */
export default function VerifyEmailScreen() {
  const params = useLocalSearchParams<{ token?: string }>();
  const { setUser } = useAuth();
  const [token, setToken] = useState(params.token ?? "");
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    setError(null);
    try {
      await api.auth.verifyEmail({ token: token.trim() });
      setUser(await api.me.get());
      router.back();
    } catch (err) {
      setError(err);
      setLoading(false);
    }
  };

  return (
    <Screen keyboard>
      <Body muted>Paste the code from the &ldquo;Confirm your email&rdquo; message. Opening the link in that email works too.</Body>
      <Field label="Confirmation code" value={token} onChangeText={setToken} error={fieldErrors(error).token} autoCapitalize="none" autoCorrect={false} autoFocus />
      <FormError error={error} />
      <Button label="Confirm email" loading={loading} disabled={token.trim().length < 20} onPress={submit} />
    </Screen>
  );
}
