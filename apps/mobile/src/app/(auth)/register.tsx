import { useState } from "react";
import { Button, Field, FormError, Screen, fieldErrors } from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function RegisterScreen() {
  const { signIn } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const errors = fieldErrors(error);

  const submit = async () => {
    setLoading(true);
    setError(null);
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      await signIn(await api.auth.register({ name, email, phone, password, timezone }));
    } catch (err) {
      setError(err);
      setLoading(false);
    }
  };

  return (
    <Screen keyboard>
      <Field label="Your name" value={name} onChangeText={setName} error={errors.name} textContentType="name" autoComplete="name" maxLength={80} />
      <Field label="Email" value={email} onChangeText={setEmail} error={errors.email} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" textContentType="username" autoComplete="email" />
      <Field label="Phone" hint="Optional. Lets friends find you by number." value={phone} onChangeText={setPhone} error={errors.phone} keyboardType="phone-pad" textContentType="telephoneNumber" />
      <Field label="Password" hint="At least 8 characters." value={password} onChangeText={setPassword} error={errors.password} secureTextEntry textContentType="newPassword" autoComplete="new-password" />
      <FormError error={error} />
      <Button label="Create account" loading={loading} disabled={!name || !email || password.length < 8} onPress={submit} />
    </Screen>
  );
}
