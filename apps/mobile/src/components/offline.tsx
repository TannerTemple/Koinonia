import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { connection } from "@/lib/api";
import { space, useTheme } from "@/lib/theme";

/**
 * A strip at the bottom of the screen while the server can't be reached. What is already
 * on screen stays usable; this says why nothing new is arriving and offers a retry.
 * When the connection comes back, everything refreshes by itself.
 */
export function OfflineNotice() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [reachable, setReachable] = useState(connection.reachable);

  useEffect(
    () =>
      connection.subscribe((ok) => {
        setReachable(ok);
        if (ok) void queryClient.invalidateQueries();
      }),
    [queryClient],
  );

  if (reachable) return null;
  return (
    <View
      accessibilityRole="alert"
      style={{ position: "absolute", left: space.md, right: space.md, bottom: insets.bottom + 76, flexDirection: "row", alignItems: "center", gap: space.md, paddingLeft: space.lg, borderRadius: 14, backgroundColor: c.text }}
    >
      <Text style={{ flex: 1, paddingVertical: space.md, fontSize: 15, lineHeight: 20, color: c.bg }}>Can&rsquo;t reach Koinonia. Check your connection.</Text>
      <Pressable accessibilityRole="button" onPress={() => void queryClient.invalidateQueries()} style={{ minHeight: 48, justifyContent: "center", paddingHorizontal: space.lg }}>
        <Text style={{ fontSize: 15, fontWeight: "800", color: c.bg }}>Try again</Text>
      </Pressable>
    </View>
  );
}
