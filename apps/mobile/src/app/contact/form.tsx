import { Stack, router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { CADENCE_PRESETS, CHANNELS, CHANNEL_LABELS, DEFAULT_REMINDER_TIME, GROUP_PRESETS, MAX_CADENCE_DAYS, joinBirthday, splitBirthday, type BirthdayParts, type Channel, type Contact } from "@koinonia/shared";
import { BirthdayField, Disclosure, DraftNotice, Button, Chip, ChipRow, Field, FormError, Label, Loading, Screen, fieldErrors } from "@/components/ui";
import { DateField } from "@/components/date-field";
import { api } from "@/lib/api";
import { showDialog } from "@/lib/dialog";
import { useDraft } from "@/lib/draft";
import { formatTime } from "@/lib/reminder-plan";
import { useAction, useContact, useToday } from "@/lib/hooks";
import { space } from "@/lib/theme";

interface PersonDraft {
  name: string;
  phone: string;
  email: string;
  relationship: string;
  birthday: BirthdayParts;
  cadenceDays: number | null;
  custom: boolean;
  preferredChannel: Channel;
  reminderTime: string | null;
  favorite: boolean;
  groups: string[];
  lastTalked: string | null;
}

/** A new person's form before anything is typed. Key order matters: drafts are compared as text. */
const BLANK: PersonDraft = { name: "", phone: "", email: "", relationship: "", birthday: { month: "", day: "", year: "" }, cadenceDays: 14, custom: false, preferredChannel: "TEXT", reminderTime: null, favorite: false, groups: [], lastTalked: null };

const fromContact = (c: Contact): PersonDraft => ({
  name: c.name,
  phone: c.phone ?? "",
  email: c.email ?? "",
  relationship: c.relationship ?? "",
  birthday: splitBirthday(c.birthday),
  cadenceDays: c.cadenceDays,
  custom: c.cadenceDays !== null && !CADENCE_PRESETS.some((p) => p.days === c.cadenceDays),
  preferredChannel: c.preferredChannel,
  reminderTime: c.reminderTime,
  favorite: c.favorite,
  groups: c.groups,
  lastTalked: null,
});

/** A kept draft, or null if it is unreadable (for example written by an older version). */
function readDraft(text: string): PersonDraft | null {
  try {
    const f = JSON.parse(text) as Partial<PersonDraft>;
    if (typeof f.name !== "string" || !f.birthday || !Array.isArray(f.groups)) return null;
    return { ...BLANK, ...f };
  } catch {
    return null;
  }
}

/** A few sensible times; 9am is the default. */
const REMINDER_TIMES = ["07:00", "09:00", "12:00", "15:00", "18:00", "20:00"];

export default function ContactFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const today = useToday();
  const existing = useContact(id);
  const [loaded, setLoaded] = useState(!id);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [relationship, setRelationship] = useState("");
  const [birthday, setBirthday] = useState<BirthdayParts>({ month: "", day: "", year: "" });
  const [more, setMore] = useState(false);
  const [reminderTime, setReminderTime] = useState<string | null>(null);
  const [favorite, setFavorite] = useState(false);
  const [groups, setGroups] = useState<string[]>([]);
  const [cadenceDays, setCadenceDays] = useState<number | null>(14);
  const [custom, setCustom] = useState(false);
  const [preferredChannel, setChannel] = useState<Channel>("TEXT");
  const [lastTalked, setLastTalked] = useState<string | null>(null);

  // Everything typed here is kept on the phone until it is saved, so a failed save, a phone
  // call or closing the app loses nothing. Only kept when it differs from what is stored.
  const draft = useDraft(`draft.person.${id ?? "new"}`);
  const [hydrated, setHydrated] = useState(false);
  const fields: PersonDraft = { name, phone, email, relationship, birthday, cadenceDays, custom, preferredChannel, reminderTime, favorite, groups, lastTalked };
  const snapshot = JSON.stringify(fields);
  const stored = JSON.stringify(existing.data ? fromContact(existing.data) : BLANK);
  const fill = (f: PersonDraft) => {
    setName(f.name);
    setPhone(f.phone);
    setEmail(f.email);
    setRelationship(f.relationship);
    setBirthday(f.birthday);
    setCadenceDays(f.cadenceDays);
    setCustom(f.custom);
    setChannel(f.preferredChannel);
    setReminderTime(f.reminderTime);
    setFavorite(f.favorite);
    setGroups(f.groups);
    setLastTalked(f.lastTalked);
  };

  useEffect(() => {
    if (!draft.ready || hydrated) return;
    if (draft.restored) {
      const kept = readDraft(draft.value);
      if (kept) {
        fill(kept);
        setMore(true);
        setLoaded(true);
        setHydrated(true);
        return;
      }
    }
    const c = existing.data;
    if (id && !c) return;
    if (c) {
      fill(fromContact(c));
      setMore(true);
    }
    setLoaded(true);
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing.data, draft.ready, draft.restored, hydrated, id]);

  const { setValue: keep } = draft;
  useEffect(() => {
    if (hydrated) keep(snapshot === stored ? "" : snapshot);
  }, [hydrated, snapshot, stored, keep]);

  const save = useAction(() => {
    const input = { name, phone, email, relationship, birthday: joinBirthday(birthday), cadenceDays, preferredChannel, reminderTime, favorite, groups };
    return id ? api.contacts.update(id, input) : api.contacts.create({ ...input, lastContactedDay: lastTalked });
  });
  const archive = useAction((archived: boolean) => api.contacts.update(id!, { archived }));
  const remove = useAction(() => api.contacts.delete(id!));
  const errors = fieldErrors(save.error);
  // A problem inside the folded section must not stay hidden.
  const hiddenError = ["phone", "email", "relationship", "birthday", "lastContactedDay"].some((key) => errors[key]);
  useEffect(() => {
    if (hiddenError) setMore(true);
  }, [hiddenError]);

  if (!loaded) return <Loading />;

  return (
    <Screen keyboard>
      <Stack.Screen options={{ title: id ? "Edit person" : "Add a person" }} />
      {draft.restored ? (
        <DraftNotice
          onDiscard={() => {
            void draft.clear();
            fill(existing.data ? fromContact(existing.data) : BLANK);
          }}
        />
      ) : null}
      <Field label="Name" value={name} onChangeText={setName} error={errors.name} maxLength={80} autoFocus={!id} placeholder="Maria Lopez" autoCapitalize="words" />
      <View>
        <Label>How often do you want to reach out?</Label>
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
        <Label>Group (optional)</Label>
        <ChipRow>
          {[...GROUP_PRESETS, ...groups.filter((g) => !GROUP_PRESETS.some((p) => p.toLowerCase() === g.toLowerCase()))].map((g) => {
            const on = groups.some((x) => x.toLowerCase() === g.toLowerCase());
            return <Chip key={g} label={g} selected={on} onPress={() => setGroups((prev) => (on ? prev.filter((x) => x.toLowerCase() !== g.toLowerCase()) : [...prev, g].slice(0, 6)))} />;
          })}
          <Chip label={favorite ? "★ Favorite" : "☆ Favorite"} selected={favorite} onPress={() => setFavorite((f) => !f)} />
        </ChipRow>
      </View>

      <Disclosure label={more ? "Fewer details" : "More details (optional): phone, email, birthday"} open={more} onToggle={() => setMore((m) => !m)}>
      <Field label="Phone" value={phone} onChangeText={setPhone} error={errors.phone} keyboardType="phone-pad" placeholder="(555) 010-2000" />
      <Field label="Email" value={email} onChangeText={setEmail} error={errors.email} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} placeholder="maria@example.com" />
      <Field label="Who are they to you?" value={relationship} onChangeText={setRelationship} error={errors.relationship} maxLength={40} placeholder="College friend, Family, Small group…" />
      <BirthdayField value={birthday} onChange={setBirthday} error={errors.birthday} />


      <View>
        <Label>What time should the reminder come?</Label>
        <ChipRow>
          {REMINDER_TIMES.map((t) => (
            <Chip key={t} label={formatTime(t)} selected={(reminderTime ?? DEFAULT_REMINDER_TIME) === t} onPress={() => setReminderTime(t === DEFAULT_REMINDER_TIME ? null : t)} />
          ))}
        </ChipRow>
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

      </Disclosure>

      <FormError error={save.error} />
      <Button
        label={id ? "Save changes" : "Add person"}
        loading={save.isPending}
        disabled={!name.trim()}
        onPress={() =>
          save.mutate(undefined, {
            onSuccess: (contact) => {
              void draft.clear();
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
              showDialog(`Delete ${existing.data.name}?`, "Their notes and history go too. This can't be undone.", [
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
