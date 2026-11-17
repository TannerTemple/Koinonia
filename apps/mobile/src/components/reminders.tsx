import { BRAND } from "@koinonia/shared";
import Constants from "expo-constants";
import { useCallback, useEffect, useState } from "react";
import { Linking, Text, View } from "react-native";
import { useAuth } from "@/lib/auth";
import { useHome } from "@/lib/hooks";
import { enableReminders, registerForPush, reminderPermission, syncReminders, type ReminderPermission } from "@/lib/notifications";
import { kv } from "@/lib/storage";
import { serif, space, useTheme } from "@/lib/theme";
import { Button, Card } from "./ui";

/**
 * Keeps this phone's reminders and the icon badge in step with the account, from anywhere
 * in the app: whenever the Today data changes (a reach-out, "Not today", an edit, a new
 * person), the reminders are planned again from scratch. Renders nothing.
 */
export function ReminderSync() {
  const { user } = useAuth();
  if (!user) return null;
  return <SyncWhenSignedIn />;
}

function SyncWhenSignedIn() {
  const { data: home } = useHome();
  useEffect(() => {
    if (home) void syncReminders(home);
  }, [home]);
  return null;
}

const DISMISSED_KEY = "koinonia.reminders.notnow";

/** Where notifications stand, and a way to turn them on that also schedules and registers. */
export function useReminderPermission() {
  const { data: home } = useHome();
  const [permission, setPermission] = useState<ReminderPermission | null>(null);
  const refresh = useCallback(() => void reminderPermission().then(setPermission), []);
  useEffect(refresh, [refresh]);

  const turnOn = useCallback(async (): Promise<boolean> => {
    const granted = await enableReminders();
    setPermission(await reminderPermission());
    if (granted) {
      if (home) await syncReminders(home);
      await registerForPush(Constants.expoConfig?.extra?.eas?.projectId as string | undefined);
    }
    return granted;
  }, [home]);

  return { permission, turnOn, refresh };
}

/**
 * Asks for notifications at the moment they make sense: once there is someone to be
 * reminded about. It explains what will be sent before the system prompt appears, and
 * "Not now" is remembered so it does not nag.
 */
export function ReminderPrompt({ people }: { people: number }) {
  const { c } = useTheme();
  const { permission, turnOn } = useReminderPermission();
  const [dismissed, setDismissed] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void kv.get(DISMISSED_KEY).then((v) => setDismissed(v === "1"));
  }, []);

  if (people === 0 || dismissed !== false || (permission !== "ask" && permission !== "off")) return null;
  const notNow = () => {
    setDismissed(true);
    void kv.set(DISMISSED_KEY, "1");
  };

  return (
    <Card style={{ padding: space.lg, gap: space.sm }}>
      <Text accessibilityRole="header" style={{ fontFamily: serif, fontSize: 21, lineHeight: 27, fontWeight: "700", color: c.text }}>
        Want a reminder on this phone?
      </Text>
      <Text style={{ fontSize: 16, lineHeight: 23, color: c.textMuted }}>
        {permission === "ask"
          ? `On the day someone is due, ${BRAND.name} sends one notification at 9 in the morning (you can pick another time for each person). That's all it uses notifications for.`
          : `Notifications are turned off for ${BRAND.name}. To get a reminder on the day someone is due, allow them in Settings.`}
      </Text>
      <View style={{ flexDirection: "row", gap: space.sm, marginTop: space.xs }}>
        {permission === "ask" ? (
          <Button
            icon="notifications"
            label="Turn on reminders"
            style={{ flex: 1.4 }}
            loading={busy}
            onPress={async () => {
              setBusy(true);
              await turnOn();
              setBusy(false);
            }}
          />
        ) : (
          <Button label="Open Settings" style={{ flex: 1.4 }} onPress={() => void Linking.openSettings()} />
        )}
        <Button variant="secondary" label="Not now" style={{ flex: 1 }} onPress={notNow} />
      </View>
    </Card>
  );
}
