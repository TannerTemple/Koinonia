import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { CHANNELS, CHANNEL_LABELS, computeNextDue, formatLongDay, type Channel } from "@koinonia/shared";
import { Body, Button, Chip, ChipRow, DraftNotice, ErrorState, Field, FormError, Label, Loading, Screen, Title } from "@/components/ui";
import { DateField } from "@/components/date-field";
import { api } from "@/lib/api";
import { useDraft } from "@/lib/draft";
import { useAction, useContact, useToday } from "@/lib/hooks";

export default function ReachOutScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const today = useToday();
  const { data: contact, error, isPending, refetch } = useContact(id);
  const [channel, setChannel] = useState<Channel | null>(null);
  const [day, setDay] = useState<string | null>(null);
  // What they typed survives a failed save or the app closing.
  const draft = useDraft(id ? `draft.reachout.${id}` : null);
  const summary = draft.value;
  const setSummary = draft.setValue;
  const log = useAction(() => api.contacts.reachOut(id, { channel: channel ?? undefined, summary, day: day ?? today }));

  useEffect(() => {
    if (contact && !channel) setChannel(contact.preferredChannel);
  }, [contact, channel]);

  if (isPending || !draft.ready) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  // The clock restarts from the day they actually talked, not from today.
  const nextDay = computeNextDue(day ?? today, contact.cadenceDays);

  return (
    <Screen keyboard>
      <View>
        <Title style={{ fontSize: 26 }}>You reached out to {contact.name.split(" ")[0]}</Title>
        <Body muted>{nextDay ? `Koinonia will remind you again on ${formatLongDay(nextDay)}.` : "No reminder is set for them."}</Body>
      </View>
      <View>
        <Label>How?</Label>
        <ChipRow>
          {CHANNELS.map((ch) => (
            <Chip key={ch} label={CHANNEL_LABELS[ch]} selected={channel === ch} onPress={() => setChannel(ch)} />
          ))}
        </ChipRow>
      </View>
      {draft.restored ? <DraftNotice onDiscard={() => { void draft.clear(); draft.seed(""); }} /> : null}
      <DateField label="When?" value={day ?? today} onChange={(d) => setDay(d)} today={today} maxDay={today} />
      <Field label="Anything to remember?" hint="Optional. Shows up in their history." value={summary} onChangeText={setSummary} multiline maxLength={500} placeholder="She got the job! Starts in January." />
      <FormError error={log.error} />
      <Button
        icon="checkmark"
        label="Save"
        loading={log.isPending}
        onPress={() =>
          log.mutate(undefined, {
            onSuccess: () => {
              void draft.clear();
              void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              router.back();
            },
          })
        }
      />
    </Screen>
  );
}
