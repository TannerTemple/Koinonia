import { Stack, router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { INTENTION_KINDS, INTENTION_KIND_LABELS, type IntentionKind } from "@koinonia/shared";
import { Button, Chip, ChipRow, Field, FormError, Label, Loading, Screen, fieldErrors } from "@/components/ui";
import { api } from "@/lib/api";
import { useAction, useContacts, useIntentions } from "@/lib/hooks";
import { space } from "@/lib/theme";

/** New intention (optionally ?contactId= to link a person) or edit one (?id=). */
export default function IntentionScreen() {
  const params = useLocalSearchParams<{ id?: string; contactId?: string }>();
  const { data: contacts } = useContacts();
  const { data: intentions } = useIntentions();
  const existing = params.id ? intentions?.find((i) => i.id === params.id) : undefined;

  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [contactId, setContactId] = useState<string | null>(params.contactId ?? null);
  const [kind, setKind] = useState<IntentionKind>(params.contactId ? "PROMISED" : "PERSONAL");
  const [loaded, setLoaded] = useState(!params.id);

  useEffect(() => {
    if (existing && !loaded) {
      setTitle(existing.title);
      setDetails(existing.details ?? "");
      setContactId(existing.contactId);
      setKind(existing.kind);
      setLoaded(true);
    }
  }, [existing, loaded]);

  const save = useAction(() => {
    const input = { title, details, kind, contactId };
    return params.id ? api.intentions.update(params.id, input) : api.intentions.create(input);
  });

  if (!loaded) return <Loading />;
  const linked = contacts?.find((p) => p.id === contactId);

  return (
    <Screen keyboard>
      <Stack.Screen options={{ title: params.id ? "Edit intention" : linked ? `Pray for ${linked.name.split(" ")[0]}` : "New intention" }} />
      <Field label="What are you praying for?" value={title} onChangeText={setTitle} error={fieldErrors(save.error).title} maxLength={140} autoFocus={!params.id} placeholder="Maria's surgery on Friday" />
      <Field label="Details" hint="Optional." value={details} onChangeText={setDetails} multiline maxLength={2000} />
      <View>
        <Label>For someone?</Label>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }} keyboardShouldPersistTaps="handled">
          <Chip tone="forest" label="No one in particular" selected={contactId === null} onPress={() => { setContactId(null); if (!params.id) setKind("PERSONAL"); }} />
          {(contacts ?? []).map((p) => (
            <Chip key={p.id} tone="forest" label={p.name} selected={contactId === p.id} onPress={() => { setContactId(p.id); if (!params.id) setKind("PROMISED"); }} />
          ))}
        </ScrollView>
      </View>
      <View>
        <Label>Kind</Label>
        <ChipRow>
          {INTENTION_KINDS.map((k) => (
            <Chip key={k} tone="forest" label={INTENTION_KIND_LABELS[k]} selected={kind === k} onPress={() => setKind(k)} />
          ))}
        </ChipRow>
      </View>
      <FormError error={save.error} />
      <Button variant="forest" label={params.id ? "Save" : "Add intention"} loading={save.isPending} disabled={!title.trim()} onPress={() => save.mutate(undefined, { onSuccess: () => router.back() })} />
    </Screen>
  );
}
