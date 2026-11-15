import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { Platform, Text, View } from "react-native";
import { CADENCE_PRESETS, cadenceLabel } from "@koinonia/shared";
import { useReminderPermission } from "@/components/reminders";
import { Button, Card, Chip, ChipRow, Field, FormError, Label, Screen, type IconName } from "@/components/ui";
import { api } from "@/lib/api";
import { useUser } from "@/lib/auth";
import { useAction, useContacts } from "@/lib/hooks";
import { kv } from "@/lib/storage";
import { serif, space, useTheme } from "@/lib/theme";

/** Remembered per account on this phone, so the welcome shows once. */
export const welcomedKey = (userId: string) => `koinonia.welcomed.${userId}`;

/** The rhythms most people want; the full list is on the person's own form. */
const QUICK_RHYTHMS = CADENCE_PRESETS.filter((p) => [7, 14, 28, 90].includes(p.days));
const STEPS = ["welcome", "people", "reminders", "done"] as const;

function Dots({ index }: { index: number }) {
  const { c } = useTheme();
  return (
    <View accessible accessibilityLabel={`Step ${index + 1} of ${STEPS.length}`} style={{ flexDirection: "row", gap: 6, justifyContent: "center" }}>
      {STEPS.map((s, i) => (
        <View key={s} style={{ width: i === index ? 22 : 8, height: 8, borderRadius: 4, backgroundColor: i <= index ? c.primary : c.border }} />
      ))}
    </View>
  );
}

function Point({ icon, tone, title, body }: { icon: IconName; tone: "primary" | "forest" | "gold"; title: string; body: string }) {
  const { c } = useTheme();
  const bg = tone === "primary" ? c.primarySoft : tone === "forest" ? c.forestSoft : c.goldSoft;
  return (
    <View style={{ flexDirection: "row", gap: space.md, alignItems: "flex-start" }}>
      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: bg, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name={icon} size={22} color={c[tone]} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontSize: 18, fontWeight: "700", color: c.text }}>{title}</Text>
        <Text style={{ fontSize: 16, lineHeight: 22, color: c.textMuted }}>{body}</Text>
      </View>
    </View>
  );
}

function Heading({ title, body }: { title: string; body: string }) {
  const { c } = useTheme();
  return (
    <View style={{ gap: space.sm }}>
      <Text accessibilityRole="header" style={{ fontFamily: serif, fontSize: 30, lineHeight: 36, fontWeight: "700", color: c.text }}>
        {title}
      </Text>
      <Text style={{ fontSize: 17, lineHeight: 24, color: c.textMuted }}>{body}</Text>
    </View>
  );
}

/** Add a few people right here: a name and how often. */
function AddPeople() {
  const { c } = useTheme();
  const people = useContacts();
  const [name, setName] = useState("");
  const [days, setDays] = useState(14);
  const add = useAction(() => api.contacts.create({ name, cadenceDays: days }));
  const added = people.data ?? [];

  return (
    <View style={{ gap: space.lg }}>
      <Card style={{ padding: space.lg, gap: space.md }}>
        <Field label="Their name" value={name} onChangeText={setName} placeholder="Mom, Uncle Joe, Maria…" autoCapitalize="words" maxLength={80} returnKeyType="done" />
        <View>
          <Label>Remind me to reach out</Label>
          <ChipRow>
            {QUICK_RHYTHMS.map((p) => (
              <Chip key={p.days} label={p.label} selected={days === p.days} onPress={() => setDays(p.days)} />
            ))}
          </ChipRow>
        </View>
        <FormError error={add.error} />
        <Button icon="add" label={name.trim() ? `Add ${name.trim().split(" ")[0]}` : "Add"} disabled={!name.trim()} loading={add.isPending} onPress={() => add.mutate(undefined, { onSuccess: () => setName("") })} />
      </Card>

      {added.length > 0 ? (
        <View style={{ gap: space.sm }} accessibilityLiveRegion="polite">
          <Text style={{ fontSize: 15, fontWeight: "700", color: c.textMuted }}>
            {added.length === 1 ? "1 person added" : `${added.length} people added`}
          </Text>
          {added.slice(0, 8).map((p) => (
            <View key={p.id} style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
              <Ionicons name="checkmark-circle" size={22} color={c.forest} />
              <Text numberOfLines={1} style={{ flex: 1, fontSize: 17, fontWeight: "600", color: c.text }}>
                {p.name}
              </Text>
              <Text style={{ fontSize: 15, color: c.textMuted }}>{cadenceLabel(p.cadenceDays).toLowerCase()}</Text>
            </View>
          ))}
          {added.length > 8 ? <Text style={{ fontSize: 15, color: c.textMuted }}>and {added.length - 8} more</Text> : null}
        </View>
      ) : null}

      <Button variant="secondary" icon="download-outline" label="Import from my contacts" onPress={() => router.push("/contact/import")} />
    </View>
  );
}

export default function WelcomeScreen() {
  const user = useUser();
  const people = useContacts();
  const reminders = useReminderPermission();
  const [index, setIndex] = useState(0);
  const [asking, setAsking] = useState(false);
  const step = STEPS[index]!;
  const count = people.data?.length ?? 0;
  const first = user.name.split(" ")[0];

  const next = () => setIndex((i) => Math.min(i + 1, STEPS.length - 1));
  const finish = () => {
    void kv.set(welcomedKey(user.id), "1");
    router.replace("/");
  };

  return (
    <Screen topInset keyboard>
      <Dots index={index} />

      {step === "welcome" ? (
        <>
          <Heading title={`Welcome, ${first}.`} body="Koinonia helps you stay close to the people you care about. It does three things." />
          <View style={{ gap: space.lg }}>
            <Point icon="chatbubbles" tone="primary" title="Reminds you to reach out" body="You choose how often for each person. Koinonia tells you when it's time." />
            <Point icon="create" tone="gold" title="Remembers for you" body="Keep a note on what to ask next time: the new job, the surgery, the kids' names." />
            <Point icon="heart" tone="forest" title="Keeps your prayer list" body="Everyone you said you'd pray for, with one set apart each day." />
          </View>
          <Button label="Get started" onPress={next} />
          <Button variant="ghost" label="Skip the tour" onPress={finish} />
        </>
      ) : null}

      {step === "people" ? (
        <>
          <Heading title="Who do you want to stay close to?" body="Start with two or three people. You can add more any time." />
          <AddPeople />
          <Button label={count ? "Continue" : "Skip for now"} variant={count ? "primary" : "ghost"} onPress={next} />
        </>
      ) : null}

      {step === "reminders" ? (
        <>
          <Heading
            title="Get a reminder on your phone?"
            body={
              Platform.OS === "web"
                ? "On an iPhone, Koinonia can send one notification on the day someone is due. This preview runs in a browser, so there is nothing to turn on here."
                : "On the day someone is due, Koinonia sends one notification at 9 in the morning. You can pick another time for each person. That's all it uses notifications for."
            }
          />
          {reminders.permission === "on" ? (
            <Point icon="checkmark-circle" tone="forest" title="Reminders are on" body="You'll hear from Koinonia when it's time to reach out." />
          ) : reminders.permission === "ask" ? (
            <Button
              icon="notifications"
              label="Turn on reminders"
              loading={asking}
              onPress={async () => {
                setAsking(true);
                await reminders.turnOn();
                setAsking(false);
                next();
              }}
            />
          ) : reminders.permission === "off" ? (
            <Point icon="notifications-off" tone="gold" title="Notifications are off for Koinonia" body="You can allow them later in the Settings app. Today will still show who is due." />
          ) : null}
          <Button variant={reminders.permission === "ask" ? "ghost" : "primary"} label={reminders.permission === "ask" ? "Not now" : "Continue"} onPress={next} />
        </>
      ) : null}

      {step === "done" ? (
        <>
          <Heading
            title="You're all set."
            body={count ? `Today will show you who to reach out to. After you talk to someone, tap “I reached out” and Koinonia starts counting again.` : "Add your first person from Today whenever you're ready."}
          />
          <View style={{ gap: space.lg }}>
            <Point icon="sunny" tone="primary" title="Today" body="Who is due, and who is next." />
            <Point icon="people" tone="gold" title="People" body="Everyone you're keeping up with, and your notes on them." />
            <Point icon="heart" tone="forest" title="Pray" body="Your prayer list. Add to it from here or from a person's page." />
          </View>
          <Button label="Go to Today" onPress={finish} />
        </>
      ) : null}
    </Screen>
  );
}
