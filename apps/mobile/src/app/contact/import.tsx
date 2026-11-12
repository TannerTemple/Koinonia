import { Ionicons } from "@expo/vector-icons";
import * as Contacts from "expo-contacts/legacy";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Linking, Pressable, Text, TextInput, View } from "react-native";
import { CADENCE_PRESETS } from "@koinonia/shared";
import { Avatar, Body, Button, Chip, ChipRow, EmptyState, FormError, Label, Loading, Rows, Screen } from "@/components/ui";
import { api } from "@/lib/api";
import { useAction } from "@/lib/hooks";
import { radius, space, useTheme } from "@/lib/theme";

interface DeviceContact {
  key: string;
  name: string;
  phone: string | null;
  email: string | null;
  birthday: string | null;
}

const pad = (n: number) => String(n).padStart(2, "0");

async function loadDeviceContacts(): Promise<DeviceContact[]> {
  const { data } = await Contacts.getContactsAsync({
    fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers, Contacts.Fields.Emails, Contacts.Fields.Birthday],
    sort: Contacts.SortTypes.FirstName,
  });
  return data
    .filter((c) => c.name?.trim())
    .map((c, i) => {
      const b = c.birthday;
      // expo-contacts months are 0-based.
      const birthday = b?.day != null && b.month != null ? `${b.year ? `${b.year}-` : ""}${pad(b.month + 1)}-${pad(b.day)}` : null;
      return {
        key: c.id ?? String(i),
        name: c.name.trim().slice(0, 80),
        phone: c.phoneNumbers?.[0]?.number ?? null,
        email: c.emails?.[0]?.email ?? null,
        birthday,
      };
    });
}

export default function ImportScreen() {
  const { c } = useTheme();
  const [state, setState] = useState<"loading" | "denied" | "ready">("loading");
  const [all, setAll] = useState<DeviceContact[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [cadenceDays, setCadenceDays] = useState<number | null>(28);

  useEffect(() => {
    (async () => {
      const { granted } = await Contacts.requestPermissionsAsync();
      if (!granted) return setState("denied");
      setAll(await loadDeviceContacts());
      setState("ready");
    })().catch(() => setState("denied"));
  }, []);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return needle ? all.filter((p) => p.name.toLowerCase().includes(needle)) : all;
  }, [all, q]);

  const doImport = useAction(() =>
    api.contacts.import({
      cadenceDays,
      contacts: all.filter((p) => selected.has(p.key)).map(({ name, phone, email, birthday }) => ({ name, phone, email, birthday })),
    }),
  );

  if (state === "loading") return <Loading />;
  if (state === "denied") {
    return (
      <Screen>
        <EmptyState
          icon="lock-closed"
          title="Koinonia can't see your contacts"
          body="Allow access in Settings to import people, or add them by hand. Your address book is only read when you choose to import."
          action={
            <View style={{ gap: space.sm }}>
              <Button label="Open Settings" onPress={() => void Linking.openSettings()} />
              <Button variant="secondary" label="Add a person by hand" onPress={() => router.replace("/contact/form")} />
            </View>
          }
        />
      </Screen>
    );
  }

  if (doImport.isSuccess) {
    const { created, skipped } = doImport.data;
    return (
      <Screen>
        <EmptyState
          icon="checkmark-circle"
          title={`${created} ${created === 1 ? "person" : "people"} added`}
          body={skipped ? `${skipped} ${skipped === 1 ? "was" : "were"} already in your list and skipped.` : "They're in your People list now. Set a different rhythm for anyone who needs it."}
          action={<Button label="Done" onPress={() => router.back()} />}
        />
      </Screen>
    );
  }

  const toggle = (key: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <Screen keyboard>
      <View style={{ gap: space.md }}>
        <Body muted>Pick only the people you want to keep up with. You don&rsquo;t need your whole address book here.</Body>
        <View>
          <Label>Remind me</Label>
          <ChipRow>
            {CADENCE_PRESETS.slice(1, 6).map((p) => (
              <Chip key={p.days} label={p.label} selected={cadenceDays === p.days} onPress={() => setCadenceDays(p.days)} />
            ))}
            <Chip label="No reminder" selected={cadenceDays === null} onPress={() => setCadenceDays(null)} />
          </ChipRow>
        </View>
        <TextInput
          accessibilityLabel="Search your contacts"
          placeholder="Search your contacts"
          placeholderTextColor={c.textMuted}
          value={q}
          onChangeText={setQ}
          clearButtonMode="while-editing"
          autoCorrect={false}
          style={{ minHeight: 44, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, color: c.text, paddingHorizontal: space.md, fontSize: 16 }}
        />
      </View>

      <FormError error={doImport.error} />
      <Button label={selected.size ? `Add ${selected.size} ${selected.size === 1 ? "person" : "people"}` : "Select people to add"} disabled={selected.size === 0 || selected.size > 500} loading={doImport.isPending} onPress={() => doImport.mutate(undefined)} />

      {visible.length === 0 ? (
        <EmptyState title={all.length ? "No matches" : "No contacts found"} body={all.length ? "Nobody in your contacts matches that search." : "This phone's address book is empty."} />
      ) : (
        <Rows>
          {visible.slice(0, 300).map((p) => {
            const on = selected.has(p.key);
            return (
              <Pressable key={p.key} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={p.name} onPress={() => toggle(p.key)} style={{ flexDirection: "row", alignItems: "center", gap: space.md, padding: space.md }}>
                <Avatar name={p.name} size={36} />
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={{ fontSize: 16, fontWeight: "600", color: c.text }}>
                    {p.name}
                  </Text>
                  <Text numberOfLines={1} style={{ fontSize: 13, color: c.textMuted }}>
                    {p.phone ?? p.email ?? "No phone or email"}
                  </Text>
                </View>
                <Ionicons name={on ? "checkmark-circle" : "ellipse-outline"} size={26} color={on ? c.primary : c.border} />
              </Pressable>
            );
          })}
        </Rows>
      )}
      {visible.length > 300 ? <Body muted style={{ textAlign: "center", fontSize: 13 }}>Showing the first 300. Search to narrow it down.</Body> : null}
    </Screen>
  );
}
