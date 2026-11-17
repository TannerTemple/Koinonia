import { useState } from "react";
import { Body, Button, Field, FormError, Screen, Title, fieldErrors } from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth, useUser } from "@/lib/auth";
import { useAction } from "@/lib/hooks";

/** Deleting everything takes the password again, so a borrowed, unlocked phone can't do it. */
export default function DeleteAccountScreen() {
  const { signOut } = useAuth();
  // Signed up with Google, Microsoft or Apple: no password to type, so DELETE confirms instead.
  const { hasPassword } = useUser();
  const [password, setPassword] = useState("");
  const remove = useAction(() => api.me.delete({ password }));

  return (
    <Screen keyboard>
      <Title>Delete your account?</Title>
      <Body muted>Everything in it will be removed: your people, notes, history and prayer list. This can&rsquo;t be undone.</Body>
      {hasPassword ? (
        <Field label="Your password" value={password} onChangeText={setPassword} error={fieldErrors(remove.error).password} secureTextEntry textContentType="password" autoComplete="current-password" />
      ) : (
        <Field label="Type DELETE to confirm" value={password} onChangeText={setPassword} error={fieldErrors(remove.error).password} autoCapitalize="characters" autoCorrect={false} />
      )}
      <FormError error={remove.error} />
      <Button variant="danger" label="Delete everything" loading={remove.isPending} disabled={!password} onPress={() => remove.mutate(undefined, { onSuccess: () => void signOut() })} />
    </Screen>
  );
}
