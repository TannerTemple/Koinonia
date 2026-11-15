import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import { dueLabel, formatDay, formatLongDay, gettingStarted, greetingFor, reachOutSummary, relativeDay, type Contact, type Home, type Note } from "@koinonia/shared";
import { PrayTodayCard, ReachOutCard } from "@/components/domain";
import { Avatar, Body, Button, Card, ErrorState, Loading, Rows, Screen, type IconName } from "@/components/ui";
import { api } from "@/lib/api";
import { useUser } from "@/lib/auth";
import { useAction, useHome, useRefresh } from "@/lib/hooks";
import { ReminderPrompt } from "@/components/reminders";
import { kv } from "@/lib/storage";
import { serif, space, useTheme } from "@/lib/theme";
import { welcomedKey } from "../welcome";

/** A big, plain heading for one of the two things the app is for. */
function Heading({ icon, tone, title, summary }: { icon: IconName; tone: "primary" | "forest"; title: string; summary?: string }) {
  const { c } = useTheme();
  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
        <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: tone === "primary" ? c.primarySoft : c.forestSoft }}>
          <Ionicons name={icon} size={20} color={c[tone]} />
        </View>
        <Text accessibilityRole="header" style={{ fontFamily: serif, fontSize: 26, fontWeight: "700", color: c.text }}>
          {title}
        </Text>
      </View>
      {summary ? <Text style={{ fontSize: 16, lineHeight: 22, color: c.textMuted }}>{summary}</Text> : null}
    </View>
  );
}

function SmallLabel({ children }: { children: string }) {
  const { c } = useTheme();
  return <Text style={{ fontSize: 14, fontWeight: "700", color: c.textMuted, marginBottom: space.sm }}>{children}</Text>;
}

/** The first three things to do, ticking themselves off. */
function GettingStartedCard({ home }: { home: Home }) {
  const { c } = useTheme();
  const steps = gettingStarted(home);
  if (steps.finished) return null;
  const rows: { done: boolean; title: string; hint: string; action?: { label: string; onPress: () => void }; second?: { label: string; onPress: () => void } }[] = [
    {
      done: steps.addedPerson,
      title: "Add someone you want to stay close to",
      hint: "Then choose how often you'd like to be reminded.",
      action: { label: "Add a person", onPress: () => router.push("/contact/form") },
      second: { label: "Or import from my contacts", onPress: () => router.push("/contact/import") },
    },
    {
      done: steps.addedPrayer,
      title: "Add something to pray for",
      hint: "For a person, or anything on your heart.",
      action: { label: "Add to prayer list", onPress: () => router.push("/intention") },
    },
    {
      done: steps.reachedOut,
      title: "After you talk to someone, tap “I reached out”",
      hint: "Koinonia starts counting again and reminds you next time.",
    },
  ];
  const next = rows.findIndex((r) => !r.done);
  return (
    <Card style={{ padding: space.lg, gap: space.md }}>
      <View style={{ gap: 2 }}>
        <Text accessibilityRole="header" style={{ fontFamily: serif, fontSize: 22, fontWeight: "700", color: c.text }}>
          Getting started
        </Text>
        <Text style={{ fontSize: 15, color: c.textMuted }}>{steps.done} of 3 done</Text>
      </View>
      {rows.map((row, i) => (
        <View key={row.title} style={{ flexDirection: "row", gap: space.md }} accessible accessibilityLabel={`Step ${i + 1}${row.done ? ", done" : ""}: ${row.title}`}>
          <View style={{ width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: row.done ? c.forest : "transparent", borderWidth: row.done ? 0 : 2, borderColor: i === next ? c.primary : c.border }}>
            {row.done ? <Ionicons name="checkmark" size={18} color={c.onPrimary} /> : <Text style={{ fontSize: 15, fontWeight: "800", color: i === next ? c.primary : c.textMuted }}>{i + 1}</Text>}
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ fontSize: 17, lineHeight: 23, fontWeight: "700", color: row.done ? c.textMuted : c.text, textDecorationLine: row.done ? "line-through" : "none" }}>{row.title}</Text>
            {!row.done ? <Text style={{ fontSize: 15, lineHeight: 21, color: c.textMuted }}>{row.hint}</Text> : null}
            {!row.done && i === next && row.action ? <Button label={row.action.label} onPress={row.action.onPress} style={{ alignSelf: "flex-start", marginTop: space.xs }} /> : null}
            {!row.done && i === next && row.second ? (
              <Pressable accessibilityRole="button" onPress={row.second.onPress} style={{ minHeight: 40, justifyContent: "center" }}>
                <Text style={{ fontSize: 15, fontWeight: "700", color: c.primary }}>{row.second.label}</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ))}
    </Card>
  );
}

function FollowUpRow({ note, today }: { note: Note; today: string }) {
  const { c } = useTheme();
  const done = useAction(() => api.notes.update(note.id, { followUpDone: true }));
  const late = note.followUpDay! < today;
  return (
    <View style={{ padding: space.md, gap: space.sm }}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${note.contactName}: ${note.body}`} onPress={() => router.push(`/contact/${note.contactId}`)} style={{ gap: 4 }}>
        <Text style={{ fontSize: 14, fontWeight: "700", color: late ? c.danger : c.primary }}>
          {note.contactName} · {relativeDay(note.followUpDay!, today)}
        </Text>
        <Text style={{ fontSize: 17, lineHeight: 23, color: c.text }}>{note.body}</Text>
      </Pressable>
      <Button small variant="secondary" icon="checkmark" label="Done" accessibilityLabel={`Mark follow-up with ${note.contactName} done`} disabled={done.isPending} onPress={() => done.mutate(undefined)} style={{ alignSelf: "flex-start" }} />
    </View>
  );
}

/** A person who isn't due yet: name and when. */
function NextRow({ contact, today }: { contact: Contact; today: string }) {
  const { c } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${contact.name}, ${dueLabel(contact.dueDay, today)}`} onPress={() => router.push(`/contact/${contact.id}`)} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: space.md, padding: space.md, opacity: pressed ? 0.6 : 1 })}>
      <Avatar name={contact.name} size={40} />
      <Text numberOfLines={1} style={{ flex: 1, fontSize: 17, fontWeight: "700", color: c.text }}>
        {contact.name}
      </Text>
      <Text style={{ fontSize: 15, color: c.textMuted }}>{contact.dueDay ? relativeDay(contact.dueDay, today) : ""}</Text>
      <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
    </Pressable>
  );
}

export default function TodayScreen() {
  const { c } = useTheme();
  const user = useUser();
  const { data: home, error, isPending, refetch } = useHome();
  const refresh = useRefresh(refetch);

  // A brand-new account gets a short welcome, once per phone.
  const isNew = home ? home.stats.contacts === 0 && !gettingStarted(home).addedPrayer : false;
  useEffect(() => {
    if (!isNew) return;
    let cancelled = false;
    void kv.get(welcomedKey(user.id)).then((seen) => {
      if (!cancelled && seen !== "1") router.push("/welcome");
    });
    return () => {
      cancelled = true;
    };
  }, [isNew, user.id]);

  if (isPending) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  const due = [...home.overdue, ...home.dueToday];
  const next = home.upcoming.length ? home.upcoming.slice(0, 5) : home.nextUp ? [home.nextUp] : [];
  const { reachOut, prayer } = home.streaks;
  const hasPeople = home.stats.contacts > 0;
  // Until the first prayer is added, the getting-started card is the only prompt for it.
  const hasPrayers = gettingStarted(home).addedPrayer;

  return (
    <Screen topInset {...refresh}>
      <View style={{ gap: 2 }}>
        <Text style={{ fontSize: 15, fontWeight: "600", color: c.textMuted }}>{formatLongDay(home.today)}</Text>
        <Text accessibilityRole="header" style={{ fontFamily: serif, fontSize: 32, lineHeight: 38, fontWeight: "700", color: c.text }}>
          {greetingFor(new Date().getHours())}, {user.name.split(" ")[0]}.
        </Text>
      </View>

      <GettingStartedCard home={home} />
      <ReminderPrompt people={home.stats.contacts} />

      {/* ---- 1. Reach out ------------------------------------------------ */}
      {hasPeople ? (
      <View style={{ gap: space.md }}>
        <Heading icon="chatbubbles" tone="primary" title="Reach out" summary={reachOutSummary(due.length, home.stats.contacts)} />

        {due.map((p) => (
          <ReachOutCard key={p.id} contact={p} today={home.today} />
        ))}

        {home.followUps.length > 0 ? (
          <View>
            <SmallLabel>Things you wanted to ask about</SmallLabel>
            <Rows>{home.followUps.map((n) => <FollowUpRow key={n.id} note={n} today={home.today} />)}</Rows>
          </View>
        ) : null}

        {next.length > 0 ? (
          <View>
            <SmallLabel>{due.length ? "Coming up" : "Next up"}</SmallLabel>
            <Rows>{next.map((p) => <NextRow key={p.id} contact={p} today={home.today} />)}</Rows>
          </View>
        ) : hasPeople && due.length === 0 ? (
          <Body muted>Nobody has a reminder set. Open a person and choose how often you&rsquo;d like to reach out.</Body>
        ) : null}

        <View style={{ flexDirection: "row", gap: space.sm }}>
          <Button variant="secondary" icon="person-add" label="Add a person" style={{ flex: 1 }} onPress={() => router.push("/contact/form")} />
          <Button variant="secondary" label="See everyone" style={{ flex: 1 }} onPress={() => router.push("/people")} />
        </View>
      </View>
      ) : null}

      {/* ---- 2. Pray ----------------------------------------------------- */}
      {hasPrayers ? (
      <View style={{ gap: space.md }}>
        <Heading icon="heart" tone="forest" title="Pray" summary={home.stats.activeIntentions ? undefined : "Keep a list of the people and things you want to pray for."} />
        <PrayTodayCard prayer={home.prayer} onChoose={home.stats.activeIntentions > 1 ? () => router.push("/choose-intention") : undefined} />
        <View style={{ flexDirection: "row", gap: space.sm }}>
          <Button variant="secondary" icon="add" label="Add to prayer list" style={{ flex: 1 }} onPress={() => router.push("/intention")} />
          {home.stats.activeIntentions > 0 ? <Button variant="secondary" label={`See list (${home.stats.activeIntentions})`} style={{ flex: 1 }} onPress={() => router.push("/prayer")} /> : null}
        </View>
      </View>
      ) : null}

      {home.birthdays.length > 0 ? (
        <View>
          <SmallLabel>Birthdays coming up</SmallLabel>
          <Rows>
            {home.birthdays.map(({ contact, day }) => (
              <Pressable key={contact.id} accessibilityRole="button" onPress={() => router.push(`/contact/${contact.id}`)} style={{ flexDirection: "row", alignItems: "center", gap: space.md, padding: space.md }}>
                <Ionicons name="gift-outline" size={24} color={c.gold} />
                <Text numberOfLines={1} style={{ flex: 1, fontSize: 17, fontWeight: "700", color: c.text }}>
                  {contact.name}
                </Text>
                <Text style={{ fontSize: 15, color: c.textMuted }}>
                  {formatDay(day, home.today)} · {relativeDay(day, home.today)}
                </Text>
              </Pressable>
            ))}
          </Rows>
        </View>
      ) : null}

      {/* Encouragement, kept small and only once there is something to show. */}
      {reachOut.longest > 0 || prayer.longest > 0 ? (
        <Pressable accessibilityRole="button" accessibilityLabel="See your week" onPress={() => router.push("/review")} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: space.sm, padding: space.md, borderRadius: 12, backgroundColor: c.surfaceAlt, opacity: pressed ? 0.7 : 1 })}>
          <Ionicons name="flame" size={20} color={c.gold} />
          <Text style={{ flex: 1, fontSize: 15, lineHeight: 21, color: c.text }}>
            {reachOut.current > 0 ? `Reached out ${reachOut.current} day${reachOut.current === 1 ? "" : "s"} in a row. ` : ""}
            {prayer.current > 0 ? `Prayed ${prayer.current} day${prayer.current === 1 ? "" : "s"} in a row. ` : ""}
            <Text style={{ fontWeight: "700", color: c.primary }}>See your week</Text>
          </Text>
          <Ionicons name="chevron-forward" size={18} color={c.primary} />
        </Pressable>
      ) : null}
    </Screen>
  );
}
