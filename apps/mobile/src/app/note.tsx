import { Stack, router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { addDays, formatDay } from "@koinonia/shared";
import { Body, Button, Chip, ChipRow, Field, FormError, Label, Loading, Screen } from "@/components/ui";
import { api } from "@/lib/api";
import { useAction, useContact, useToday } from "@/lib/hooks";

const FOLLOW_UP: [string, number | null][] = [
  ["No follow-up", null],
  ["Tomorrow", 1],
  ["In 3 days", 3],
  ["Next week", 7],
  ["In 2 weeks", 14],
  ["In a month", 30],
];

/** Add a note to a person (?contactId=) or edit one (?id=&contactId=). */
export default function NoteScreen() {
  const { id, contactId } = useLocalSearchParams<{ id?: string; contactId: string }>();
  const today = useToday();
  const { data: contact } = useContact(contactId);
  const existing = id ? contact?.notes.find((n) => n.id === id) : undefined;
  const [body, setBody] = useState("");
  const [followUp, setFollowUp] = useState<number | null | "keep">(id ? "keep" : null);
  const [loaded, setLoaded] = useState(!id);

  useEffect(() => {
    if (existing && !loaded) {
      setBody(existing.body);
      setLoaded(true);
    }
  }, [existing, loaded]);

  const save = useAction(() => {
    const followUpDay = followUp === "keep" ? undefined : followUp === null ? null : addDays(today, followUp);
    return id ? api.notes.update(id, { body, ...(followUpDay === undefined ? {} : { followUpDay }) }) : api.notes.create(contactId, { body, followUpDay });
  });

  if (!loaded || !contact) return <Loading />;

  return (
    <Screen keyboard>
      <Stack.Screen options={{ title: id ? "Edit note" : `Note about ${contact.name.split(" ")[0]}` }} />
      <Field label="Note" value={body} onChangeText={setBody} multiline autoFocus maxLength={4000} placeholder="What do you want to remember? What should you ask about next time?" style={{ minHeight: 140 }} />
      <View>
        <Label>Remind me about this</Label>
        <ChipRow>
          {existing?.followUpDay ? <Chip label={`Keep ${formatDay(existing.followUpDay, today)}`} selected={followUp === "keep"} onPress={() => setFollowUp("keep")} /> : null}
          {FOLLOW_UP.map(([label, days]) => (
            <Chip key={label} label={label} selected={followUp === days || (followUp === "keep" && days === null && !existing?.followUpDay)} onPress={() => setFollowUp(days)} />
          ))}
        </ChipRow>
        <Body muted style={{ fontSize: 13, marginTop: 8 }}>
          A follow-up shows on Today and sends a reminder when the day comes.
        </Body>
      </View>
      <FormError error={save.error} />
      <Button label="Save note" loading={save.isPending} disabled={!body.trim()} onPress={() => save.mutate(undefined, { onSuccess: () => router.back() })} />
    </Screen>
  );
}
