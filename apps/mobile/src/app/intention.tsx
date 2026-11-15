import { Stack, router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { INTENTION_KINDS, INTENTION_KIND_LABELS, type IntentionKind } from "@koinonia/shared";
import { DraftNotice, Disclosure, Button, Chip, ChipRow, Field, FormError, Label, Loading, Screen, fieldErrors } from "@/components/ui";
import { api } from "@/lib/api";
import { useDraft } from "@/lib/draft";
import { useAction, useContacts, useIntentions } from "@/lib/hooks";
import { space } from "@/lib/theme";

/** New intention (optionally ?contactId= to link a person) or edit one (?id=). */
export default function IntentionScreen() {
  const params = useLocalSearchParams<{ id?: string; contactId?: string }>();
  const { data: contacts } = useContacts();
  const { data: intentions } = useIntentions();
  const existing = params.id ? intentions?.find((i) => i.id === params.id) : undefined;

  // Kept on the phone until saved, so a dropped connection never loses what was typed.
  const base = `draft.prayer.${params.contactId ?? "any"}.${params.id ?? "new"}`;
  const titleDraft = useDraft(`${base}.title`);
  const detailsDraft = useDraft(`${base}.details`);
  const title = titleDraft.value;
  const setTitle = titleDraft.setValue;
  const details = detailsDraft.value;
  const setDetails = detailsDraft.setValue;
  const draftsReady = titleDraft.ready && detailsDraft.ready;
  const restored = titleDraft.restored || detailsDraft.restored;
  const [contactId, setContactId] = useState<string | null>(params.contactId ?? null);
  const [kind, setKind] = useState<IntentionKind>(params.contactId ? "PROMISED" : "PERSONAL");
  const [loaded, setLoaded] = useState(!params.id);
  const [more, setMore] = useState(false);

  useEffect(() => {
    if (existing && !loaded && draftsReady) {
      if (!restored) {
        titleDraft.seed(existing.title);
        detailsDraft.seed(existing.details ?? "");
      }
      setContactId(existing.contactId);
      setKind(existing.kind);
      setMore(Boolean(existing.details) || detailsDraft.restored);
      setLoaded(true);
    }
  }, [existing, loaded, draftsReady, restored, titleDraft, detailsDraft]);

  const save = useAction(() => {
    const input = { title, details, kind, contactId };
    return params.id ? api.intentions.update(params.id, input) : api.intentions.create(input);
  });

  if (!loaded || !draftsReady) return <Loading />;
  const linked = contacts?.find((p) => p.id === contactId);

  return (
    <Screen keyboard>
      <Stack.Screen options={{ title: params.id ? "Edit prayer" : linked ? `Pray for ${linked.name.split(" ")[0]}` : "Add to prayer list" }} />
      <Field label="What do you want to pray for?" value={title} onChangeText={setTitle} error={fieldErrors(save.error).title} maxLength={140} autoFocus={!params.id} placeholder="Maria's surgery on Friday" />
      {restored ? (
        <DraftNotice
          onDiscard={() => {
            void titleDraft.clear();
            void detailsDraft.clear();
            titleDraft.seed(existing?.title ?? "");
            detailsDraft.seed(existing?.details ?? "");
          }}
        />
      ) : null}
      <View>
        <Label>Is it for someone?</Label>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }} keyboardShouldPersistTaps="handled">
          <Chip tone="forest" label="No one in particular" selected={contactId === null} onPress={() => { setContactId(null); if (!params.id) setKind("PERSONAL"); }} />
          {(contacts ?? []).map((p) => (
            <Chip key={p.id} tone="forest" label={p.name} selected={contactId === p.id} onPress={() => { setContactId(p.id); if (!params.id) setKind("PROMISED"); }} />
          ))}
        </ScrollView>
      </View>
      <Disclosure label={more ? "Less" : "More (optional): details, kind of prayer"} open={more} onToggle={() => setMore((m) => !m)}>
      <Field label="Details" hint="Anything you want to remember about it." value={details} onChangeText={setDetails} multiline maxLength={2000} />
      <View>
        <Label>What kind of prayer?</Label>
        <ChipRow>
          {INTENTION_KINDS.map((k) => (
            <Chip key={k} tone="forest" label={INTENTION_KIND_LABELS[k]} selected={kind === k} onPress={() => setKind(k)} />
          ))}
        </ChipRow>
      </View>
      </Disclosure>
      <FormError error={save.error} />
      <Button variant="forest" label={params.id ? "Save" : "Add to prayer list"} loading={save.isPending} disabled={!title.trim()} onPress={() =>
          save.mutate(undefined, {
            onSuccess: () => {
              void titleDraft.clear();
              void detailsDraft.clear();
              router.back();
            },
          })
        } />
    </Screen>
  );
}
