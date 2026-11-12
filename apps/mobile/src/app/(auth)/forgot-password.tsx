import { Link, router } from "expo-router";
import { useState } from "react";
import { Body, Button, Field, FormError, Screen, Title, fieldErrors } from "@/components/ui";
import { api } from "@/lib/api";
import { space, useTheme } from "@/lib/theme";

export default function ForgotPasswordScreen() {
  const { c } = useTheme();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    setLoading(true);
    setError(null);
    try {
      await api.auth.forgotPassword({ email });
      setSent(true);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <Screen>
        <Title>Check your email</Title>
        <Body muted>If {email.trim()} has a Koinonia account, a reset email is on its way. It has a link, and a code you can paste here. Both work for one hour.</Body>
        <Button label="I have a reset code" onPress={() => router.push("/reset-password")} />
        <Button variant="ghost" label="Back to sign in" onPress={() => router.dismissTo("/login")} />
      </Screen>
    );
  }

  return (
    <Screen keyboard>
      <Body muted>Enter your email and we&rsquo;ll send you a way to choose a new password.</Body>
      <Field label="Email" value={email} onChangeText={setEmail} error={fieldErrors(error).email} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" textContentType="username" autoComplete="email" returnKeyType="send" onSubmitEditing={submit} />
      <FormError error={error} />
      <Button label="Send reset email" loading={loading} disabled={!email.trim()} onPress={submit} />
      <Link href="/reset-password" style={{ color: c.primary, fontWeight: "700", fontSize: 16, textAlign: "center", padding: space.sm }}>
        I have a reset code
      </Link>
    </Screen>
  );
}
