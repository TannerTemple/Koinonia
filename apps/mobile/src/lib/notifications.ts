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
    shouldSetBadge: true,
  }),
});

/**
 * Where notifications stand on this phone:
 * - "on": allowed
 * - "ask": never asked yet; we can show the system prompt once
 * - "off": refused; only the Settings app can turn them on
 * - "unsupported": the browser preview
 */
export type ReminderPermission = "on" | "ask" | "off" | "unsupported";

export async function reminderPermission(): Promise<ReminderPermission> {
  if (!supported) return "unsupported";
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return "on";
  return current.canAskAgain ? "ask" : "off";
}

export async function remindersAllowed(): Promise<boolean> {
  return (await reminderPermission()) === "on";
}

/** Asks for notification permission (the system only shows its prompt the first time). */
export async function enableReminders(): Promise<boolean> {
  if (!supported) return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const next = await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowBadge: true, allowSound: true } });
  return next.granted;
}

/**
 * Reschedules this phone's reminders from the latest Today data, and sets the number on
 * the app icon to how many people are waiting. Called whenever that data changes, so a
 * reach-out, "Not today" or an edit moves the reminders with it. Works with no server
 * keys at all: the reminders are scheduled on the phone itself.
 */
let syncing: Promise<number> | null = null;
let queued: Home | null = null;

export function syncReminders(home: Home): Promise<number> {
  // Never run two syncs at once (one cancelling what the other just scheduled); the latest data wins.
  if (syncing) {
    queued = home;
    return syncing;
  }
  syncing = runSync(home).finally(() => {
    syncing = null;
    if (queued) {
      const next = queued;
      queued = null;
      void syncReminders(next);
    }
  });
  return syncing;
}

async function runSync(home: Home): Promise<number> {
  if (!(await remindersAllowed())) return 0;
  const now = new Date();
  const plans = planReminders(home, { hour: now.getHours(), minute: now.getMinutes() });
  await Notifications.cancelAllScheduledNotificationsAsync();
  let scheduled = 0;
  for (const plan of plans) {
    const [y, m, d] = plan.day.split("-").map(Number) as [number, number, number];
    const date = new Date(y, m - 1, d, plan.hour, plan.minute, 0);
    if (date.getTime() <= Date.now()) continue;
    try {
      await Notifications.scheduleNotificationAsync({
        identifier: plan.id,
        content: { title: plan.title, body: plan.body, badge: plan.badge, data: { url: plan.url } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date },
      });
      scheduled += 1;
    } catch {
      /* one bad reminder must not stop the rest */
    }
  }
  await Notifications.setBadgeCountAsync(home.overdue.length + home.dueToday.length).catch(() => undefined);
  return scheduled;
}

export async function clearReminders() {
  if (!supported) return;
  queued = null;
  await Notifications.cancelAllScheduledNotificationsAsync().catch(() => undefined);
  await Notifications.setBadgeCountAsync(0).catch(() => undefined);
}

/** The screen a notification points at, if it is one of ours. */
function urlOf(response: Notifications.NotificationResponse | null | undefined): string | null {
  const url = response?.notification.request.content.data?.url;
  return typeof url === "string" && url.startsWith("/") ? url : null;
}

/**
 * Calls `open` with the screen to show when a reminder is tapped: both while the app is
 * running and when the tap is what launched it. Returns a function that stops listening.
 */
export function onReminderTapped(open: (url: string) => void): () => void {
  if (!supported) return () => undefined;
  let handledLaunch = false;
  void Notifications.getLastNotificationResponseAsync().then((response) => {
    const url = urlOf(response);
    if (url && !handledLaunch) {
      handledLaunch = true;
      open(url);
    }
  }).catch(() => undefined);
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    handledLaunch = true;
    const url = urlOf(response);
    if (url) open(url);
  });
  return () => subscription.remove();
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
