import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Share, Text, View } from "react-native";
import type { UserSearchResult } from "@koinonia/shared";
import { Avatar, Badge, Button, EmptyState, ErrorState, Field, Loading, Rows, Screen } from "@/components/ui";
import { api } from "@/lib/api";
import { useAction } from "@/lib/hooks";
import { space, useTheme } from "@/lib/theme";

function Result({ result }: { result: UserSearchResult }) {
  const { c } = useTheme();
  const add = useAction(() => api.contacts.create({ name: result.name, email: result.email, phone: result.phone, linkedUserId: result.id, cadenceDays: 14 }));
  const added = result.alreadyContact || add.isSuccess;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space.md, padding: space.md }}>
      <Avatar name={result.name} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 16, fontWeight: "700", color: c.text }}>{result.name}</Text>
        <Text style={{ fontSize: 13, color: c.textMuted }}>{result.email ?? result.phone ?? "Koinonia member"}</Text>
      </View>
      {added ? <Badge tone="forest" icon="checkmark" label="In your people" /> : <Button small icon="person-add" label="Add" accessibilityLabel={`Add ${result.name}`} loading={add.isPending} onPress={() => add.mutate(undefined)} />}
    </View>
  );
}

export default function FindScreen() {
  const [input, setInput] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setQ(input.trim()), 300);
    return () => clearTimeout(t);
  }, [input]);
  const { data, error, isFetching, refetch } = useQuery({ queryKey: ["userSearch", q], queryFn: () => api.users.search(q), enabled: q.length >= 2 });

  return (
    <Screen keyboard>
      <Field label="Search by name, or exact email or phone" value={input} onChangeText={setInput} autoCapitalize="none" autoCorrect={false} autoFocus placeholder="Maria Lopez" />
      {q.length < 2 ? (
        <EmptyState icon="search" title="Look someone up" body="Type at least two letters. People who turned off discovery in their settings won't appear." />
      ) : error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : !data && isFetching ? (
        <Loading />
      ) : data && data.length > 0 ? (
        <Rows>{data.map((r) => <Result key={r.id} result={r} />)}</Rows>
      ) : (
        <EmptyState
          title="No one by that name yet"
          body="They may not be on Koinonia. You can still add them yourself, or invite them."
          action={
            <View style={{ gap: space.sm }}>
              <Button variant="secondary" label="Add them by hand" onPress={() => router.replace("/contact/form")} />
              <Button icon="share-outline" label="Invite to Koinonia" onPress={() => void Share.share({ message: "I'm using Koinonia to stay in touch with the people who matter to me. Join me!" })} />
            </View>
          }
        />
      )}
    </Screen>
  );
}
