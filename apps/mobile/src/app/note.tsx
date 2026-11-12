import { Stack, router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Button, Field, FormError, Loading, Screen } from "@/components/ui";
import { DateField } from "@/components/date-field";
import { api } from "@/lib/api";
import { useAction, useContact, useToday } from "@/lib/hooks";

/** Add a note to a person (?contactId=) or edit one (?id=&contactId=). */
export default function NoteScreen() {
  const { id, contactId } = useLocalSearchParams<{ id?: string; contactId: string }>();
  const today = useToday();
  const { data: contact } = useContact(contactId);
  const existing = id ? contact?.notes.find((n) => n.id === id) : undefined;
  const [body, setBody] = useState("");
  const [followUp, setFollowUp] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!id);

  useEffect(() => {
    if (existing && !loaded) {
      setBody(existing.body);
      setFollowUp(existing.followUpDay);
      setLoaded(true);
    }
  }, [existing, loaded]);

  const save = useAction(() => {
    // Only send the follow-up day on an edit when it changed, so a finished follow-up isn't reopened.
    const changed = followUp !== (existing?.followUpDay ?? null);
    return id ? api.notes.update(id, { body, ...(changed ? { followUpDay: followUp } : {}) }) : api.notes.create(contactId, { body, followUpDay: followUp });
  });

  if (!loaded || !contact) return <Loading />;

  return (
    <Screen keyboard>
      <Stack.Screen options={{ title: id ? "Edit note" : `Note about ${contact.name.split(" ")[0]}` }} />
      <Field label="Note" value={body} onChangeText={setBody} multiline autoFocus maxLength={4000} placeholder="What do you want to remember? What should you ask about next time?" style={{ minHeight: 140 }} />
      <DateField
        label="Remind me about this"
        value={followUp}
        onChange={setFollowUp}
        today={today}
        minDay={followUp && followUp < today ? followUp : today}
        emptyLabel="No follow-up"
        hint="A follow-up shows on Today and sends a reminder when the day comes."
      />
      <FormError error={save.error} />
      <Button label="Save note" loading={save.isPending} disabled={!body.trim()} onPress={() => save.mutate(undefined, { onSuccess: () => router.back() })} />
    </Screen>
  );
}
