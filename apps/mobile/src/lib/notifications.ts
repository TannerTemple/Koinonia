import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import type { Home } from "@koinonia/shared";
import { api } from "./api";
import { planReminders } from "./reminder-plan";

/** Local notifications are a native feature; the browser preview skips them. */
const supported = Platform.OS !== "web";

if (supported) Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function remindersAllowed(): Promise<boolean> {
  if (!supported) return false;
  const { granted } = await Notifications.getPermissionsAsync();
  return granted;
}

/** Asks for notification permission (only prompts the first time). */
export async function enableReminders(): Promise<boolean> {
  if (!supported) return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const next = await Notifications.requestPermissionsAsync();
  return next.granted;
}

/**
 * Reschedules this device's local reminders from the latest Today data. These work
 * with no server keys at all: they are scheduled on the phone itself.
 */
export async function syncReminders(home: Home): Promise<number> {
  if (!(await remindersAllowed())) return 0;
  const plans = planReminders(home, new Date().getHours());
  await Notifications.cancelAllScheduledNotificationsAsync();
  for (const plan of plans) {
    const [y, m, d] = plan.day.split("-").map(Number) as [number, number, number];
    await Notifications.scheduleNotificationAsync({
      identifier: plan.id,
      content: { title: plan.title, body: plan.body, data: { url: plan.url } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(y, m - 1, d, plan.hour, 0, 0) },
    });
  }
  await Notifications.setBadgeCountAsync(home.overdue.length + home.dueToday.length).catch(() => undefined);
  return plans.length;
}

export async function clearReminders() {
  if (!supported) return;
  await Notifications.cancelAllScheduledNotificationsAsync().catch(() => undefined);
  await Notifications.setBadgeCountAsync(0).catch(() => undefined);
}

/**
 * Registers this phone for server-sent pushes (the daily digest). Needs an EAS project id,
 * so it quietly does nothing in Expo Go / before EAS is set up.
 */
let pushToken: string | undefined;
/** This phone's push token, if it was registered, so sign-out can unregister it. */
export const currentPushToken = () => pushToken;

export async function registerForPush(projectId: string | undefined) {
  if (!Device.isDevice || !projectId || !(await remindersAllowed())) return;
  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    await api.devices.register({ token: data, platform: Device.osName === "iOS" ? "ios" : "android" });
    pushToken = data;
  } catch {
    /* push is optional; local reminders still work */
  }
}
