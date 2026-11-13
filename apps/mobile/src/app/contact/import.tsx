import { Ionicons } from "@expo/vector-icons";
import * as Contacts from "expo-contacts/legacy";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Linking, Platform, Pressable, Text, TextInput, View } from "react-native";
import { CADENCE_PRESETS, chunk, parseVCards, type ImportResult } from "@koinonia/shared";
import { Avatar, Body, Button, Chip, ChipRow, EmptyState, FormError, Label, Loading, Rows, Screen } from "@/components/ui";
import { api } from "@/lib/api";
import { toImportables, type DeviceContact, type Importable } from "@/lib/device-contacts";
import { useAction } from "@/lib/hooks";
import { radius, space, useTheme } from "@/lib/theme";

type State =
  | { kind: "loading" }
  /** The user said no (or Settings says no). */
  | { kind: "denied"; canAskAgain: boolean }
  /** No address book here (the browser preview): import from a contacts file instead. */
  | { kind: "file" }
  /** Something else went wrong; say what, and offer to try again. */
  | { kind: "error"; message: string }
  | { kind: "ready"; limited: boolean };

const BATCH = 200;
const SHOWN = 300;

/** Lets the browser preview pick a .vcf file; resolves with its text, or null if cancelled. */
function pickContactsFile(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".vcf,text/vcard,text/x-vcard";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      file.text().then(resolve, () => resolve(null));
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}

export default function ImportScreen() {
  const { c } = useTheme();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [all, setAll] = useState<Importable[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [cadenceDays, setCadenceDays] = useState<number | null>(28);

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      if (Platform.OS === "web" || !(await Contacts.isAvailableAsync())) return setState({ kind: "file" });

      const permission = await Contacts.requestPermissionsAsync();
      if (!permission.granted) return setState({ kind: "denied", canAskAgain: permission.canAskAgain });

      const { data } = await Contacts.getContactsAsync({
        fields: [
          Contacts.Fields.Name,
          Contacts.Fields.FirstName,
          Contacts.Fields.MiddleName,
          Contacts.Fields.LastName,
          Contacts.Fields.Company,
          Contacts.Fields.PhoneNumbers,
          Contacts.Fields.Emails,
          Contacts.Fields.Birthday,
        ],
      });
      setAll(toImportables(data as DeviceContact[]));
      setSelected(new Set());
      // iOS 18 lets people share only some contacts.
      setState({ kind: "ready", limited: (permission as { accessPrivileges?: string }).accessPrivileges === "limited" });
    } catch (err) {
      // A failure here is not a refusal: show what happened instead of blaming permissions.
      setState({ kind: "error", message: err instanceof Error ? err.message : "The address book couldn't be read." });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const loadFile = async () => {
    const text = await pickContactsFile();
    if (text === null) return;
    const people = parseVCards(text).map((p, i) => ({ ...p, key: `file-${i}` }));
    if (people.length === 0) return setState({ kind: "error", message: "That file has no contacts in it. Export a vCard (.vcf) from your address book and try again." });
    setAll(people.sort((a, b) => a.name.localeCompare(b.name)));
    setSelected(new Set());
    setState({ kind: "ready", limited: false });
  };

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return all;
    const digits = needle.replace(/\D/g, "");
    return all.filter((p) => p.name.toLowerCase().includes(needle) || p.email?.toLowerCase().includes(needle) || (digits.length >= 3 && p.phone?.replace(/\D/g, "").includes(digits)));
  }, [all, q]);

  // Any number of people: sent in batches the API accepts, totals added up.
  const doImport = useAction(async (): Promise<ImportResult> => {
    const chosen = all.filter((p) => selected.has(p.key)).map(({ name, phone, email, birthday }) => ({ name, phone, email, birthday }));
    const total: ImportResult = { created: 0, skipped: 0 };
    for (const contacts of chunk(chosen, BATCH)) {
      const result = await api.contacts.import({ cadenceDays, contacts });
      total.created += result.created;
      total.skipped += result.skipped;
    }
    return total;
  });

  if (state.kind === "loading") return <Loading />;

  if (state.kind === "denied") {
    return (
      <Screen>
        <EmptyState
          icon="lock-closed"
          title="Koinonia can't see your contacts"
          body={
            state.canAskAgain
              ? "Koinonia only reads your address book when you choose to import, and only sends the people you pick."
              : "Access is turned off. Open Settings, choose Koinonia, and allow Contacts. Your address book is only read when you choose to import."
          }
          action={
            <View style={{ gap: space.sm }}>
              {state.canAskAgain ? <Button label="Allow access" onPress={() => void load()} /> : <Button label="Open Settings" onPress={() => void Linking.openSettings()} />}
              <Button variant="secondary" label="Add a person by hand" onPress={() => router.replace("/contact/form")} />
            </View>
          }
        />
      </Screen>
    );
  }

  if (state.kind === "file") {
    return (
      <Screen>
        <EmptyState
          icon="document-text-outline"
          title="Import from a contacts file"
          body="There is no address book to read here. Export your contacts as a vCard (.vcf) file from iCloud, Google Contacts or Outlook, then choose it."
          action={
            <View style={{ gap: space.sm }}>
              <Button label="Choose a .vcf file" onPress={() => void loadFile()} />
              <Button variant="secondary" label="Add a person by hand" onPress={() => router.replace("/contact/form")} />
            </View>
          }
        />
      </Screen>
    );
  }

  if (state.kind === "error") {
    return (
      <Screen>
        <EmptyState
          icon="alert-circle-outline"
          title="Couldn't read your contacts"
          body={state.message}
          action={
            <View style={{ gap: space.sm }}>
              <Button label="Try again" onPress={() => void load()} />
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
  const shown = visible.slice(0, SHOWN);
  const allShownSelected = shown.length > 0 && shown.every((p) => selected.has(p.key));
  const toggleShown = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const p of shown) {
        if (allShownSelected) next.delete(p.key);
        else next.add(p.key);
      }
      return next;
    });

  return (
    <Screen keyboard>
      <View style={{ gap: space.md }}>
        <Body muted>Pick only the people you want to keep up with. You don&rsquo;t need your whole address book here.</Body>
        {state.limited ? (
          <Pressable accessibilityRole="button" onPress={() => void Linking.openSettings()} style={{ flexDirection: "row", gap: space.sm, alignItems: "center", padding: space.md, borderRadius: radius.md, backgroundColor: c.primarySoft }}>
            <Ionicons name="information-circle-outline" size={20} color={c.primaryStrong} />
            <Text style={{ flex: 1, fontSize: 14, color: c.primaryStrong }}>You&rsquo;ve shared only some contacts with Koinonia. Tap to share more in Settings.</Text>
          </Pressable>
        ) : null}
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
          placeholder="Search by name, phone or email"
          placeholderTextColor={c.textMuted}
          value={q}
          onChangeText={setQ}
          clearButtonMode="while-editing"
          autoCorrect={false}
          style={{ minHeight: 44, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, color: c.text, paddingHorizontal: space.md, fontSize: 16 }}
        />
      </View>

      <FormError error={doImport.error} />
      <Button label={selected.size ? `Add ${selected.size} ${selected.size === 1 ? "person" : "people"}` : "Select people to add"} disabled={selected.size === 0} loading={doImport.isPending} onPress={() => doImport.mutate(undefined)} />

      {visible.length === 0 ? (
        <EmptyState title={all.length ? "No matches" : "No contacts found"} body={all.length ? "Nobody in your contacts matches that search." : "This address book is empty."} />
      ) : (
        <View style={{ gap: space.sm }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ fontSize: 13, color: c.textMuted }}>
              {visible.length} {visible.length === 1 ? "contact" : "contacts"}
              {selected.size ? ` · ${selected.size} selected` : ""}
            </Text>
            <Button small variant="ghost" label={allShownSelected ? "Clear these" : "Select all"} onPress={toggleShown} />
          </View>
          <Rows>
            {shown.map((p) => {
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
        </View>
      )}
      {visible.length > SHOWN ? <Body muted style={{ textAlign: "center", fontSize: 13 }}>Showing the first {SHOWN}. Search to narrow it down.</Body> : null}
    </Screen>
  );
}
