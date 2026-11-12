import { Stack, router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, View } from "react-native";
import { CADENCE_PRESETS, CHANNELS, CHANNEL_LABELS, MAX_CADENCE_DAYS, type Channel } from "@koinonia/shared";
import { Button, Chip, ChipRow, Field, FormError, Label, Loading, Screen, fieldErrors } from "@/components/ui";
import { DateField } from "@/components/date-field";
import { api } from "@/lib/api";
import { useAction, useContact, useToday } from "@/lib/hooks";
import { space } from "@/lib/theme";

export default function ContactFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const today = useToday();
  const existing = useContact(id);
  const [loaded, setLoaded] = useState(!id);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [relationship, setRelationship] = useState("");
  const [birthday, setBirthday] = useState("");
  const [cadenceDays, setCadenceDays] = useState<number | null>(14);
  const [custom, setCustom] = useState(false);
  const [preferredChannel, setChannel] = useState<Channel>("TEXT");
  const [lastTalked, setLastTalked] = useState<string | null>(null);

  useEffect(() => {
    const c = existing.data;
    if (!c || loaded) return;
    setName(c.name);
    setPhone(c.phone ?? "");
    setEmail(c.email ?? "");
    setRelationship(c.relationship ?? "");
    setBirthday(c.birthday ?? "");
    setCadenceDays(c.cadenceDays);
    setCustom(c.cadenceDays !== null && !CADENCE_PRESETS.some((p) => p.days === c.cadenceDays));
    setChannel(c.preferredChannel);
    setLoaded(true);
  }, [existing.data, loaded]);

  const save = useAction(() => {
    const input = { name, phone, email, relationship, birthday, cadenceDays, preferredChannel };
    return id ? api.contacts.update(id, input) : api.contacts.create({ ...input, lastContactedDay: lastTalked });
  });
  const archive = useAction((archived: boolean) => api.contacts.update(id!, { archived }));
  const remove = useAction(() => api.contacts.delete(id!));
  const errors = fieldErrors(save.error);

  if (!loaded) return <Loading />;

  return (
    <Screen keyboard>
      <Stack.Screen options={{ title: id ? "Edit person" : "Add a person" }} />
      <Field label="Name" value={name} onChangeText={setName} error={errors.name} maxLength={80} autoFocus={!id} placeholder="Maria Lopez" autoCapitalize="words" />
      <Field label="Phone" value={phone} onChangeText={setPhone} error={errors.phone} keyboardType="phone-pad" placeholder="(555) 010-2000" />
      <Field label="Email" value={email} onChangeText={setEmail} error={errors.email} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} placeholder="maria@example.com" />
      <Field label="Who are they to you?" value={relationship} onChangeText={setRelationship} error={errors.relationship} maxLength={40} placeholder="College friend, Family, Small group…" />
      <Field label="Birthday" hint="MM-DD, or YYYY-MM-DD if you know the year." value={birthday} onChangeText={setBirthday} error={errors.birthday} placeholder="04-12" keyboardType="numbers-and-punctuation" />

      <View>
        <Label>Remind me to reach out</Label>
        <ChipRow>
          {CADENCE_PRESETS.map((p) => (
            <Chip key={p.days} label={p.label} selected={!custom && cadenceDays === p.days} onPress={() => { setCustom(false); setCadenceDays(p.days); }} />
          ))}
          <Chip label="Custom" selected={custom} onPress={() => { setCustom(true); setCadenceDays((d) => d ?? 10); }} />
          <Chip label="No reminder" selected={!custom && cadenceDays === null} onPress={() => { setCustom(false); setCadenceDays(null); }} />
        </ChipRow>
        {custom ? (
          <View style={{ marginTop: space.md }}>
            <Field
              label="Every how many days?"
              value={cadenceDays ? String(cadenceDays) : ""}
              onChangeText={(t) => {
                const n = Number(t.replace(/\D/g, ""));
                setCadenceDays(n ? Math.min(MAX_CADENCE_DAYS, n) : null);
              }}
              keyboardType="number-pad"
              error={errors.cadenceDays}
            />
          </View>
        ) : null}
      </View>

      <View>
        <Label>Usual way to reach them</Label>
        <ChipRow>
          {CHANNELS.map((ch) => (
            <Chip key={ch} label={CHANNEL_LABELS[ch]} selected={preferredChannel === ch} onPress={() => setChannel(ch)} />
          ))}
        </ChipRow>
      </View>

      {!id ? (
        <DateField label="When did you last talk?" value={lastTalked} onChange={setLastTalked} today={today} maxDay={today} emptyLabel="Not sure" hint="Optional. The first reminder counts from this day." />
      ) : null}

      <FormError error={save.error} />
      <Button
        label={id ? "Save changes" : "Add person"}
        loading={save.isPending}
        disabled={!name.trim()}
        onPress={() =>
          save.mutate(undefined, {
            onSuccess: (contact) => {
              if (id) router.back();
              else router.replace(`/contact/${contact.id}`);
            },
          })
        }
      />

      {id && existing.data ? (
        <View style={{ gap: space.sm }}>
          <Button
            variant="secondary"
            label={existing.data.archived ? "Restore from archive" : "Archive (pause reminders)"}
            loading={archive.isPending}
            onPress={() => archive.mutate(!existing.data.archived, { onSuccess: () => router.back() })}
          />
          <Button
            variant="danger"
            label={`Delete ${existing.data.name}`}
            loading={remove.isPending}
            onPress={() =>
              Alert.alert(`Delete ${existing.data.name}?`, "Their notes and history go too. This can't be undone.", [
                { text: "Cancel", style: "cancel" },
                { text: "Delete", style: "destructive", onPress: () => remove.mutate(undefined, { onSuccess: () => router.dismissTo("/people") }) },
              ])
            }
          />
        </View>
      ) : null}
    </Screen>
  );
}
