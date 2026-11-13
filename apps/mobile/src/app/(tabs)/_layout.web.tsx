import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import type { ColorValue } from "react-native";
import { useTheme } from "@/lib/theme";

/** Browser preview only: the native tab bar in `_layout.tsx` is what ships on iOS. */
export default function TabsLayoutWeb() {
  const { c } = useTheme();
  const icon = (name: React.ComponentProps<typeof Ionicons>["name"]) =>
    function TabIcon({ color, size }: { color: ColorValue; size: number }) {
      return <Ionicons name={name} color={color as string} size={size} />;
    };
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: c.primary, tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.border } }}>
      <Tabs.Screen name="index" options={{ title: "Today", tabBarIcon: icon("sunny") }} />
      <Tabs.Screen name="people" options={{ title: "People", tabBarIcon: icon("people") }} />
      <Tabs.Screen name="prayer" options={{ title: "Prayer", tabBarIcon: icon("heart") }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: icon("person-circle") }} />
    </Tabs>
  );
}
