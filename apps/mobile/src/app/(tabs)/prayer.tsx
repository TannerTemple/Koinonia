import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { DailyIntentionCard, IntentionRow } from "@/components/domain";
import { Body, Button, Chip, ChipRow, EmptyState, ErrorState, Loading, Rows, Screen, SectionTitle, Title } from "@/components/ui";
import { useIntentions, usePrayerToday, useRefresh } from "@/lib/hooks";
import { space } from "@/lib/theme";

type Tab = "ACTIVE" | "ANSWERED" | "ARCHIVED";
const TABS: [Tab, string][] = [
  ["ACTIVE", "Praying"],
  ["ANSWERED", "Answered"],
  ["ARCHIVED", "Archived"],
];

export default function PrayerScreen() {
  const [tab, setTab] = useState<Tab>("ACTIVE");
  const today = usePrayerToday();
  const intentions = useIntentions();
  const refresh = useRefresh(today.refetch, intentions.refetch);

  const error = today.error ?? intentions.error;
  if (error) return <ErrorState error={error} onRetry={() => void refresh.onRefresh()} />;
  if (!today.data || !intentions.data) return <Loading />;

  const all = intentions.data;
  const active = all.filter((i) => i.status === "ACTIVE");
  const shown = all.filter((i) => i.status === tab);
  // Grouped by whether the prayer is for a person, which is how people think of their list.
  const promised = shown.filter((i) => i.contactId !== null);
  const others = shown.filter((i) => i.contactId === null);
  const day = today.data.day;
  const todayId = today.data.intention?.id;

  return (
    <Screen topInset {...refresh}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flex: 1 }}>
          <Title>Prayer list</Title>
          <Body muted>{active.length ? `${active.filter((i) => i.prayedToday).length} of ${active.length} prayed for today` : "The people and things you want to pray for"}</Body>
        </View>
        <Button small variant="forest" icon="add" label="Add" accessibilityLabel="Add to prayer list" onPress={() => router.push("/intention")} />
      </View>

      {/* With nothing on the list, the empty state below says it once. */}
      {active.length > 0 ? <DailyIntentionCard prayer={today.data} onChoose={active.length > 1 ? () => router.push("/choose-intention") : undefined} /> : null}

      <ChipRow>
        {TABS.map(([key, label]) => (
          <Chip key={key} tone="forest" label={`${label} ${all.filter((i) => i.status === key).length}`} selected={tab === key} onPress={() => setTab(key)} />
        ))}
      </ChipRow>

      {shown.length === 0 ? (
        tab === "ACTIVE" ? (
          <EmptyState
            icon="heart"
            title="“I'll pray for you.”"
            body="Easy to say, easy to forget. Write down who and what you want to pray for, and it will be waiting here."
            action={<Button variant="forest" icon="add" label="Add to prayer list" onPress={() => router.push("/intention")} />}
          />
        ) : (
          <EmptyState
            title={tab === "ANSWERED" ? "No answered prayers yet" : "Nothing archived"}
            body={tab === "ANSWERED" ? "When a prayer is answered, mark it and it will be kept here to look back on with gratitude." : "Prayers you set aside rest here."}
          />
        )
      ) : (
        <View style={{ gap: space.xl }}>
          {promised.length ? (
            <View>
              <SectionTitle tone="forest" count={promised.length}>For people</SectionTitle>
              <Rows>{promised.map((i) => <IntentionRow key={i.id} intention={i} today={day} isToday={i.id === todayId} />)}</Rows>
            </View>
          ) : null}
          {others.length ? (
            <View>
              <SectionTitle tone="forest" count={others.length}>Other prayers</SectionTitle>
              <Rows>{others.map((i) => <IntentionRow key={i.id} intention={i} today={day} isToday={i.id === todayId} />)}</Rows>
            </View>
          ) : null}
        </View>
      )}
    </Screen>
  );
}
