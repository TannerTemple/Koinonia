import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { CHANNELS, CHANNEL_LABELS, addDays, cadenceLabel, type Channel } from "@koinonia/shared";
import { Body, Button, Chip, ChipRow, ErrorState, Field, FormError, Label, Loading, Screen, Title } from "@/components/ui";
import { api } from "@/lib/api";
import { useAction, useContact, useToday } from "@/lib/hooks";

const WHEN: [string, number][] = [
  ["Today", 0],
  ["Yesterday", 1],
  ["2 days ago", 2],
  ["Last week", 7],
];

export default function ReachOutScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const today = useToday();
  const { data: contact, error, isPending, refetch } = useContact(id);
  const [channel, setChannel] = useState<Channel | null>(null);
  const [daysAgo, setDaysAgo] = useState(0);
  const [summary, setSummary] = useState("");
  const log = useAction(() => api.contacts.reachOut(id, { channel: channel ?? undefined, summary, day: addDays(today, -daysAgo) }));

  useEffect(() => {
    if (contact && !channel) setChannel(contact.preferredChannel);
  }, [contact, channel]);

  if (isPending) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  return (
    <Screen keyboard>
      <View>
        <Title style={{ fontSize: 26 }}>You reached out to {contact.name.split(" ")[0]}</Title>
        <Body muted>{contact.cadenceDays ? `Next reminder: ${cadenceLabel(contact.cadenceDays).toLowerCase()} from then.` : "No reminder is set for them."}</Body>
      </View>
      <View>
        <Label>How?</Label>
        <ChipRow>
          {CHANNELS.map((ch) => (
            <Chip key={ch} label={CHANNEL_LABELS[ch]} selected={channel === ch} onPress={() => setChannel(ch)} />
          ))}
        </ChipRow>
      </View>
      <View>
        <Label>When?</Label>
        <ChipRow>
          {WHEN.map(([label, n]) => (
            <Chip key={label} label={label} selected={daysAgo === n} onPress={() => setDaysAgo(n)} />
          ))}
        </ChipRow>
      </View>
      <Field label="Anything to remember?" hint="Optional. Shows up in their history." value={summary} onChangeText={setSummary} multiline maxLength={500} placeholder="She got the job! Starts in January." />
      <FormError error={log.error} />
      <Button
        icon="checkmark"
        label="Log it"
        loading={log.isPending}
        onPress={() =>
          log.mutate(undefined, {
            onSuccess: () => {
              void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              router.back();
            },
          })
        }
      />
    </Screen>
  );
}
