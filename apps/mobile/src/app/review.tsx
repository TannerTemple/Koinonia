import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { compareWeeks, formatDay, weekHeadline, weekdayName, type Streak, type WeekSummary } from "@koinonia/shared";
import { Avatar, Body, Card, ErrorState, Loading, Rows, Screen, SectionTitle, type IconName } from "@/components/ui";
import { useRefresh, useWeeklyReview } from "@/lib/hooks";
import { serif, space, useTheme } from "@/lib/theme";

function Compare({ label, now, before }: { label: string; now: number; before: number }) {
  const { c } = useTheme();
  const { direction, label: text } = compareWeeks(now, before);
  const color = direction === "up" ? c.forest : c.textMuted;
  return (
    <Card style={{ padding: space.lg, flexDirection: "row", alignItems: "center", gap: space.lg }}>
      <Text style={{ fontFamily: serif, fontSize: 40, fontWeight: "700", color: c.text, minWidth: 56, fontVariant: ["tabular-nums"] }}>{now}</Text>
      <View style={{ flex: 1, gap: 4 }} accessible accessibilityLabel={`${label}: ${now}. ${text}, which had ${before}.`}>
        <Text style={{ fontSize: 16, fontWeight: "700", color: c.text }}>{label}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Ionicons name={direction === "up" ? "arrow-up" : direction === "down" ? "arrow-down" : "remove"} size={14} color={color} />
          <Text style={{ fontSize: 14, fontWeight: "600", color, flex: 1 }}>
            {text} ({before})
          </Text>
        </View>
      </View>
    </Card>
  );
}

function DayStrip({ week, today }: { week: WeekSummary; today: string }) {
  const { c } = useTheme();
  const max = Math.max(1, ...week.days.flatMap((d) => [d.reachOuts, d.prayers]));
  const bar = (n: number, color: string) => <View style={{ width: 10, height: n ? Math.max(6, (n / max) * 80) : 0, borderTopLeftRadius: 3, borderTopRightRadius: 3, backgroundColor: color }} />;
  return (
    <Card style={{ padding: space.lg, gap: space.md }}>
      <View style={{ flexDirection: "row" }}>
        {week.days.map((d) => (
          <View key={d.day} accessible accessibilityLabel={`${weekdayName(d.day)}, ${formatDay(d.day, today)}: ${d.reachOuts} reach-outs, ${d.prayers} prayers`} style={{ flex: 1, alignItems: "center", gap: 6 }}>
            <View style={{ height: 80, flexDirection: "row", alignItems: "flex-end", gap: 3 }}>
              {bar(d.reachOuts, c.primary)}
              {bar(d.prayers, c.forest)}
            </View>
            <Text style={{ fontSize: 12, fontWeight: "700", color: d.day === today ? c.primary : c.textMuted }}>{weekdayName(d.day).slice(0, 2)}</Text>
          </View>
        ))}
      </View>
      <View style={{ gap: 4 }}>
        <Legend color={c.primary} text={`Reach-outs · ${week.daysReachedOut} of 7 days`} />
        <Legend color={c.forest} text={`Prayers · ${week.daysPrayed} of 7 days`} />
      </View>
    </Card>
  );
}

function Legend({ color, text }: { color: string; text: string }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: color }} />
      <Text style={{ fontSize: 14, color: c.textMuted }}>{text}</Text>
    </View>
  );
}

function StreakRow({ icon, label, streak }: { icon: IconName; label: string; streak: Streak }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space.md, padding: space.md }}>
      <Ionicons name={icon} size={26} color={c.gold} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontSize: 16, fontWeight: "700", color: c.text }}>
          {label}: {streak.current} day{streak.current === 1 ? "" : "s"}
        </Text>
        <Text style={{ fontSize: 14, color: c.textMuted }}>
          Best {streak.longest}
          {streak.current > 0 && !streak.doneToday ? " · keep it going today" : ""}
        </Text>
      </View>
    </View>
  );
}

export default function WeeklyReviewScreen() {
  const { c } = useTheme();
  const { data, error, isPending, refetch } = useWeeklyReview();
  const refresh = useRefresh(refetch);
  if (isPending) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  const { thisWeek, lastWeek, streaks, today } = data;

  return (
    <Screen {...refresh}>
      <View style={{ gap: space.xs }}>
        <Body muted style={{ fontSize: 14 }}>
          {formatDay(thisWeek.startDay, today)} to {formatDay(thisWeek.endDay, today)}, next to the seven days before
        </Body>
        <Text accessibilityRole="header" style={{ fontFamily: serif, fontSize: 24, lineHeight: 30, fontWeight: "700", color: c.text }}>
          {weekHeadline(thisWeek.peopleReached, thisWeek.prayers)}
        </Text>
      </View>

      <View style={{ gap: space.sm }}>
        <Compare label="People reached" now={thisWeek.peopleReached} before={lastWeek.peopleReached} />
        <Compare label="Reach-outs" now={thisWeek.reachOuts} before={lastWeek.reachOuts} />
        <Compare label="Prayers said" now={thisWeek.prayers} before={lastWeek.prayers} />
      </View>

      <View>
        <SectionTitle>Day by day</SectionTitle>
        <DayStrip week={thisWeek} today={today} />
      </View>

      <View>
        <SectionTitle tone="gold">Streaks</SectionTitle>
        <Rows>
          {[<StreakRow key="r" icon="flame" label="Reach-out streak" streak={streaks.reachOut} />, <StreakRow key="p" icon="heart" label="Prayer streak" streak={streaks.prayer} />]}
        </Rows>
      </View>

      <View>
        <SectionTitle count={thisWeek.people.length}>Who you reached</SectionTitle>
        {thisWeek.people.length ? (
          <Rows>
            {thisWeek.people.map((p) => (
              <Pressable key={p.id} accessibilityRole="button" accessibilityLabel={`${p.name}, ${p.reachOuts === 1 ? "once" : `${p.reachOuts} times`}`} onPress={() => router.push(`/contact/${p.id}`)} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: space.md, padding: space.md, opacity: pressed ? 0.6 : 1 })}>
                <Avatar name={p.name} size={36} />
                <Text numberOfLines={1} style={{ flex: 1, fontSize: 16, fontWeight: "700", color: c.text }}>
                  {p.name}
                </Text>
                <Text style={{ fontSize: 14, color: c.textMuted }}>{p.reachOuts === 1 ? "once" : `${p.reachOuts} times`}</Text>
              </Pressable>
            ))}
          </Rows>
        ) : (
          <Body muted>Nobody yet this week. Today is a good day to start.</Body>
        )}
      </View>
    </Screen>
  );
}
