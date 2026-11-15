import { Stack, router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Button, DraftNotice, Field, FormError, Loading, Screen } from "@/components/ui";
import { DateField } from "@/components/date-field";
import { api } from "@/lib/api";
import { useDraft } from "@/lib/draft";
import { useAction, useContact, useToday } from "@/lib/hooks";

/** Add a note to a person (?contactId=) or edit one (?id=&contactId=). */
export default function NoteScreen() {
  const { id, contactId } = useLocalSearchParams<{ id?: string; contactId: string }>();
  const today = useToday();
  const { data: contact } = useContact(contactId);
  const existing = id ? contact?.notes.find((n) => n.id === id) : undefined;
  // What is typed here is kept on the phone until it is saved, so a dropped connection never loses it.
  const draft = useDraft(contactId ? `draft.note.${contactId}.${id ?? "new"}` : null);
  const body = draft.value;
  const setBody = draft.setValue;
  const [followUp, setFollowUp] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!id);

  useEffect(() => {
    if (existing && !loaded && draft.ready) {
      if (!draft.restored) draft.seed(existing.body);
      setFollowUp(existing.followUpDay);
      setLoaded(true);
    }
  }, [existing, loaded, draft]);

  const save = useAction(() => {
    // Only send the follow-up day on an edit when it changed, so a finished follow-up isn't reopened.
    const changed = followUp !== (existing?.followUpDay ?? null);
    return id ? api.notes.update(id, { body, ...(changed ? { followUpDay: followUp } : {}) }) : api.notes.create(contactId, { body, followUpDay: followUp });
  });

  if (!loaded || !contact || !draft.ready) return <Loading />;

  return (
    <Screen keyboard>
      <Stack.Screen options={{ title: id ? "Edit note" : `Note about ${contact.name.split(" ")[0]}` }} />
      <Field label="Note" value={body} onChangeText={setBody} multiline autoFocus maxLength={4000} placeholder="What do you want to remember? What should you ask about next time?" style={{ minHeight: 140 }} />
      {draft.restored ? (
        <DraftNotice
          onDiscard={() => {
            void draft.clear();
            draft.seed(existing?.body ?? "");
          }}
        />
      ) : null}
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
      <Button label="Save note" loading={save.isPending} disabled={!body.trim()} onPress={() =>
          save.mutate(undefined, {
            onSuccess: () => {
              void draft.clear();
              router.back();
            },
          })
        } />
    </Screen>
  );
}
