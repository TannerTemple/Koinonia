import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, router } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { ApiError } from "@koinonia/shared";
import { AuthProvider, useAuth } from "@/lib/auth";
import { ReminderSync } from "@/components/reminders";
import { DialogHost } from "@/lib/dialog";
import { onReminderTapped } from "@/lib/notifications";
import { serif, useTheme } from "@/lib/theme";

void SplashScreen.preventAutoHideAsync();

function RootStack() {
  const { user } = useAuth();
  const { c } = useTheme();

  useEffect(() => {
    if (user !== undefined) void SplashScreen.hideAsync();
  }, [user]);

  // Tapping a reminder opens the person it is about, whether the app was open or not.
  // Wait until we know who is signed in, so the screen exists to navigate to.
  const signedIn = Boolean(user);
  useEffect(() => {
    if (!signedIn) return;
    return onReminderTapped((url) => router.push(url as never));
  }, [signedIn]);

  if (user === undefined) return null;

  const modal = { presentation: "modal" as const };
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: c.bg },
        headerTintColor: c.primary,
        headerTitleStyle: { fontFamily: serif, color: c.text },
        headerShadowVisible: false,
        headerBackButtonDisplayMode: "minimal",
        contentStyle: { backgroundColor: c.bg },
      }}
    >
      <Stack.Protected guard={Boolean(user)}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="contact/[id]" options={{ title: "" }} />
        <Stack.Screen name="contact/form" options={{ ...modal, title: "Person" }} />
        <Stack.Screen name="contact/reach-out" options={{ ...modal, title: "I reached out" }} />
        <Stack.Screen name="contact/import" options={{ ...modal, title: "Import contacts" }} />
        <Stack.Screen name="contact/find" options={{ title: "Find people" }} />
        <Stack.Screen name="note" options={{ ...modal, title: "Note" }} />
        <Stack.Screen name="intention" options={{ ...modal, title: "Prayer" }} />
        <Stack.Screen name="delete-account" options={{ ...modal, title: "Delete account" }} />
        <Stack.Screen name="welcome" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="review" options={{ title: "Your week" }} />
        <Stack.Screen name="verify-email" options={{ ...modal, title: "Confirm your email" }} />
        <Stack.Screen name="choose-intention" options={{ ...modal, title: "Pray today for" }} />
      </Stack.Protected>
      <Stack.Protected guard={!user}>
        <Stack.Screen name="(auth)/login" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)/register" options={{ title: "Create account", headerBackTitle: "Sign in" }} />
        <Stack.Screen name="(auth)/forgot-password" options={{ title: "Forgot password", headerBackTitle: "Sign in" }} />
        <Stack.Screen name="(auth)/reset-password" options={{ title: "New password" }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const { c, dark } = useTheme();
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: (count, error) => count < 1 && !(error instanceof ApiError && error.status >= 400),
          },
        },
      }),
  );
  const base = dark ? DarkTheme : DefaultTheme;
  const theme = { ...base, colors: { ...base.colors, background: c.bg, card: c.surface, text: c.text, border: c.border, primary: c.primary } };

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider value={theme}>
          <StatusBar style="auto" />
          <RootStack />
          <ReminderSync />
          <DialogHost />
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
