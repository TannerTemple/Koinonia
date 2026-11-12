import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import { formatDay, formatLongDay, relativeDay, type Home, type Note } from "@koinonia/shared";
import { ContactRow, DailyIntentionCard, Hero } from "@/components/domain";
import { Avatar, Body, Button, EmptyState, ErrorState, IconButton, Loading, Rows, Screen, SectionTitle, type IconName } from "@/components/ui";
import { api } from "@/lib/api";
import { useUser } from "@/lib/auth";
import { useAction, useHome, useRefresh } from "@/lib/hooks";
import { syncReminders } from "@/lib/notifications";
import { radius, serif, space, useTheme } from "@/lib/theme";

function greeting(): string {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

function Stat({ icon, value, label, lit }: { icon: IconName; value: number; label: string; lit?: boolean }) {
  const { c } = useTheme();
  return (
    <View accessible accessibilityLabel={`${value} ${label}`} style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.12)", borderRadius: radius.md, padding: space.md, gap: 2 }}>
      <Ionicons name={icon} size={20} color={lit ? "#E0B458" : c.onHeroMuted} />
      <Text style={{ color: c.onHero, fontSize: 26, fontWeight: "800", fontVariant: ["tabular-nums"] }}>{value}</Text>
      <Text style={{ color: c.onHeroMuted, fontSize: 11, fontWeight: "700", letterSpacing: 0.6 }}>{label.toUpperCase()}</Text>
    </View>
  );
}

function TodayHero({ home }: { home: Home }) {
  const { c } = useTheme();
  const user = useUser();
  const due = home.overdue.length + home.dueToday.length;
  return (
    <Hero tone="blue">
      <Text style={{ color: c.onHeroMuted, fontSize: 14, fontWeight: "600" }}>{formatLongDay(home.today)}</Text>
      <Text accessibilityRole="header" style={{ fontFamily: serif, color: c.onHero, fontSize: 30, lineHeight: 36, fontWeight: "700" }}>
        {greeting()}, {user.name.split(" ")[0]}.
      </Text>
      <Text style={{ color: c.onHeroMuted, fontSize: 16, lineHeight: 22 }}>
        {due === 0
          ? home.stats.contacts === 0
            ? "Add the people you want to stay close to."
            : "You're all caught up. Nobody is waiting on you today."
          : due === 1
            ? "One person would love to hear from you today."
            : `${due} people would love to hear from you today.`}
      </Text>
      <View style={{ flexDirection: "row", gap: space.sm, marginTop: space.sm }}>
        <Stat icon="flame" value={home.streaks.reachOut.current} label="day reach-out streak" lit={home.streaks.reachOut.doneToday} />
        <Stat icon="heart" value={home.streaks.prayer.current} label="day prayer streak" lit={home.streaks.prayer.doneToday} />
        <Stat icon="checkmark-done" value={home.stats.reachOutsThisWeek} label="this week" />
      </View>
      <Pressable accessibilityRole="button" onPress={() => router.push("/review")} style={({ pressed }) => ({ minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, opacity: pressed ? 0.6 : 1 })}>
        <Text style={{ color: c.onHero, fontWeight: "700", fontSize: 15 }}>See your week</Text>
        <Ionicons name="arrow-forward" size={16} color={c.onHero} />
      </Pressable>
    </Hero>
  );
}

function FollowUpRow({ note, today }: { note: Note; today: string }) {
  const { c } = useTheme();
  const done = useAction(() => api.notes.update(note.id, { followUpDone: true }));
  return (
    <View style={{ flexDirection: "row", alignItems: "center", paddingRight: space.sm }}>
      <Pressable accessibilityRole="button" onPress={() => router.push(`/contact/${note.contactId}`)} style={{ flex: 1, flexDirection: "row", gap: space.md, padding: space.md }}>
        <Ionicons name="create-outline" size={20} color={c.primary} style={{ marginTop: 2 }} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontSize: 16, fontWeight: "600", color: c.text }}>{note.body}</Text>
          <Text style={{ fontSize: 13, color: note.followUpDay! < today ? c.danger : c.textMuted }}>
            {note.contactName} · {relativeDay(note.followUpDay!, today)}
          </Text>
        </View>
      </Pressable>
      <IconButton icon="checkmark-circle-outline" label={`Mark follow-up with ${note.contactName} done`} disabled={done.isPending} onPress={() => done.mutate(undefined)} />
    </View>
  );
}

export default function TodayScreen() {
  const { c } = useTheme();
  const { data: home, error, isPending, refetch } = useHome();
  const refresh = useRefresh(refetch);

  // Keep this phone's local reminders in step with the latest due dates.
  useEffect(() => {
    if (home) void syncReminders(home);
  }, [home]);

  if (isPending) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  return (
    <Screen topInset {...refresh}>
      <TodayHero home={home} />

      {home.stats.contacts === 0 ? (
        <EmptyState
          icon="people"
          title="Start with three people"
          body="Think of the people you'd regret drifting from. Add them, pick how often you want to be in touch, and Koinonia keeps count."
          action={
            <View style={{ gap: space.sm }}>
              <Button icon="person-add" label="Add a person" onPress={() => router.push("/contact/form")} />
              <Button variant="secondary" icon="download-outline" label="Import from my contacts" onPress={() => router.push("/contact/import")} />
            </View>
          }
        />
      ) : null}

      {home.overdue.length > 0 ? (
        <View>
          <SectionTitle tone="danger" count={home.overdue.length}>Overdue</SectionTitle>
          <Rows>{home.overdue.map((p) => <ContactRow key={p.id} contact={p} today={home.today} actions />)}</Rows>
        </View>
      ) : null}

      {home.dueToday.length > 0 ? (
        <View>
          <SectionTitle tone="gold" count={home.dueToday.length}>Reach out today</SectionTitle>
          <Rows>{home.dueToday.map((p) => <ContactRow key={p.id} contact={p} today={home.today} actions />)}</Rows>
        </View>
      ) : null}

      {home.followUps.length > 0 ? (
        <View>
          <SectionTitle count={home.followUps.length}>Follow-ups from your notes</SectionTitle>
          <Rows>{home.followUps.map((n) => <FollowUpRow key={n.id} note={n} today={home.today} />)}</Rows>
        </View>
      ) : null}

      <DailyIntentionCard prayer={home.prayer} />

      {home.birthdays.length > 0 ? (
        <View>
          <SectionTitle tone="gold">Birthdays coming up</SectionTitle>
          <Rows>
            {home.birthdays.map(({ contact, day }) => (
              <Pressable key={contact.id} accessibilityRole="button" onPress={() => router.push(`/contact/${contact.id}`)} style={{ flexDirection: "row", alignItems: "center", gap: space.md, padding: space.md }}>
                <Avatar name={contact.name} size={40} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: "700", color: c.text }}>{contact.name}</Text>
                  <Text style={{ fontSize: 13, color: c.textMuted }}>
                    {formatDay(day, home.today)} · {relativeDay(day, home.today)}
                  </Text>
                </View>
                <Ionicons name="gift-outline" size={20} color={c.gold} />
              </Pressable>
            ))}
          </Rows>
        </View>
      ) : null}

      {home.upcoming.length > 0 ? (
        <View>
          <SectionTitle count={home.upcoming.length}>Coming up</SectionTitle>
          <Rows>{home.upcoming.map((p) => <ContactRow key={p.id} contact={p} today={home.today} />)}</Rows>
        </View>
      ) : home.stats.contacts > 0 && home.overdue.length + home.dueToday.length === 0 ? (
        <Body muted style={{ textAlign: "center" }}>
          Nothing else scheduled for the next two weeks.
        </Body>
      ) : null}
    </Screen>
  );
}
