import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import Constants from "expo-constants";
import { useEffect, useState } from "react";
import { Alert, Linking, Switch, Text, View } from "react-native";
import type { Streak } from "@koinonia/shared";
import { Avatar, Body, Button, Card, Field, FormError, Screen, SectionTitle, Title, fieldErrors, type IconName } from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth, useUser } from "@/lib/auth";
import { useAction, useHome, useRefresh } from "@/lib/hooks";
import { enableReminders, registerForPush, remindersAllowed, syncReminders } from "@/lib/notifications";
import { space, useTheme } from "@/lib/theme";

function StreakCard({ icon, label, streak }: { icon: IconName; label: string; streak: Streak }) {
  const { c } = useTheme();
  return (
    <Card style={{ flex: 1, padding: space.lg, gap: space.xs }}>
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.goldSoft, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name={icon} size={20} color={c.gold} />
      </View>
      <Text style={{ fontSize: 30, fontWeight: "800", color: c.text, fontVariant: ["tabular-nums"] }}>
        {streak.current}
        <Text style={{ fontSize: 15, fontWeight: "600", color: c.textMuted }}> {streak.current === 1 ? "day" : "days"}</Text>
      </Text>
      <Text style={{ fontSize: 14, fontWeight: "700", color: c.text }}>{label}</Text>
      <Text style={{ fontSize: 13, color: c.textMuted }}>
        Best {streak.longest}. {streak.doneToday ? "Done for today." : streak.current > 0 ? "Keep it alive today." : "Start today."}
      </Text>
    </Card>
  );
}

function ToggleRow({ label, description, value, onChange, disabled }: { label: string; description: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space.md, padding: space.lg }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontSize: 16, fontWeight: "700", color: c.text }}>{label}</Text>
        <Text style={{ fontSize: 13, lineHeight: 18, color: c.textMuted }}>{description}</Text>
      </View>
      <Switch accessibilityLabel={label} value={value} onValueChange={onChange} disabled={disabled} trackColor={{ true: c.primary }} />
    </View>
  );
}

export default function ProfileScreen() {
  const { c } = useTheme();
  const user = useUser();
  const { signOut, setUser } = useAuth();
  const { data: home, refetch } = useHome();
  const refresh = useRefresh(refetch);
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone ?? "");
  const [notifications, setNotifications] = useState(false);

  const save = useAction(() => api.me.update({ name, phone }));
  const prefs = useAction((input: { discoverable?: boolean; digestEnabled?: boolean }) => api.me.update(input));
  const remove = useAction(api.me.delete);

  useEffect(() => {
    void remindersAllowed().then(setNotifications);
  }, []);

  const turnOnNotifications = async () => {
    const granted = await enableReminders();
    setNotifications(granted);
    if (!granted) {
      Alert.alert("Notifications are off", "Turn them on for Koinonia in Settings to get reminders.", [
        { text: "Not now", style: "cancel" },
        { text: "Open Settings", onPress: () => void Linking.openSettings() },
      ]);
      return;
    }
    if (home) await syncReminders(home);
    await registerForPush(Constants.expoConfig?.extra?.eas?.projectId as string | undefined);
  };

  const copyCalendar = async () => {
    try {
      const { url } = await api.me.calendarFeed();
      await Clipboard.setStringAsync(url);
      Alert.alert("Calendar link copied", "In the Calendar app: Calendars → Add Calendar → Add Subscription Calendar, then paste. Keep the link private.");
    } catch {
      Alert.alert("Couldn't get the link", "Check your connection and try again.");
    }
  };

  return (
    <Screen topInset keyboard {...refresh}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
        <Avatar name={user.name} size={56} />
        <View style={{ flex: 1 }}>
          <Title style={{ fontSize: 26 }}>{user.name}</Title>
          <Body muted>{user.email}</Body>
        </View>
      </View>

      {home ? (
        <View>
          <SectionTitle tone="gold">Your streaks</SectionTitle>
          <View style={{ flexDirection: "row", gap: space.md }}>
            <StreakCard icon="flame" label="Reach-out streak" streak={home.streaks.reachOut} />
            <StreakCard icon="heart" label="Prayer streak" streak={home.streaks.prayer} />
          </View>
        </View>
      ) : null}

      <View>
        <SectionTitle>Reminders</SectionTitle>
        <Card>
          <ToggleRow
            label="Notifications on this iPhone"
            description="A 9am reminder on the day someone is due, and for your note follow-ups."
            value={notifications}
            onChange={(v) => (v ? void turnOnNotifications() : Alert.alert("Turn off in Settings", "To stop reminders, turn off notifications for Koinonia in Settings.", [{ text: "OK" }, { text: "Open Settings", onPress: () => void Linking.openSettings() }]))}
          />
          <View style={{ height: 1, backgroundColor: c.border }} />
          <ToggleRow
            label="Daily email summary"
            description="A morning email listing who to reach out to."
            value={user.digestEnabled}
            disabled={prefs.isPending}
            onChange={(v) => prefs.mutate({ digestEnabled: v }, { onSuccess: setUser })}
          />
          <View style={{ height: 1, backgroundColor: c.border }} />
          <ToggleRow
            label="Let friends find me"
            description="Other members can find you by name, email or phone."
            value={user.discoverable}
            disabled={prefs.isPending}
            onChange={(v) => prefs.mutate({ discoverable: v }, { onSuccess: setUser })}
          />
        </Card>
        <Button variant="secondary" icon="calendar-outline" label="Add reach-outs to my calendar" style={{ marginTop: space.md }} onPress={() => void copyCalendar()} />
      </View>

      <View style={{ gap: space.md }}>
        <SectionTitle>Profile</SectionTitle>
        <Field label="Name" value={name} onChangeText={setName} error={fieldErrors(save.error).name} maxLength={80} />
        <Field label="Phone" value={phone} onChangeText={setPhone} error={fieldErrors(save.error).phone} keyboardType="phone-pad" />
        <Body muted style={{ fontSize: 13 }}>Timezone: {user.timezone}</Body>
        <FormError error={save.error} />
        <Button variant="secondary" label={save.isSuccess ? "Saved" : "Save profile"} loading={save.isPending} disabled={!name.trim()} onPress={() => save.mutate(undefined, { onSuccess: setUser })} />
      </View>

      <View style={{ gap: space.md }}>
        <SectionTitle tone="danger">Account</SectionTitle>
        <Button variant="secondary" icon="log-out-outline" label="Sign out" onPress={() => void signOut()} />
        <Button
          variant="danger"
          label="Delete my account"
          loading={remove.isPending}
          onPress={() =>
            Alert.alert("Delete your account?", "Everything in it will be removed. This can't be undone.", [
              { text: "Cancel", style: "cancel" },
              { text: "Delete", style: "destructive", onPress: () => remove.mutate(undefined, { onSuccess: () => void signOut() }) },
            ])
          }
        />
      </View>
    </Screen>
  );
}
