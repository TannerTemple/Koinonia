import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { Body, FormError, Loading, Rows, Screen } from "@/components/ui";
import { api } from "@/lib/api";
import { useAction, useIntentions, usePrayerToday } from "@/lib/hooks";
import { space, useTheme } from "@/lib/theme";

/** Pick the special intention for today. */
export default function ChooseIntentionScreen() {
  const { c } = useTheme();
  const { data: intentions } = useIntentions();
  const { data: today } = usePrayerToday();
  const choose = useAction((id: string) => api.prayer.setToday(id));

  if (!intentions || !today) return <Loading />;
  const active = intentions.filter((i) => i.status === "ACTIVE");

  return (
    <Screen>
      <Body muted>Who or what do you want to carry in a special way today?</Body>
      <FormError error={choose.error} />
      <Rows>
        {active.map((i) => {
          const current = i.id === today.intention?.id;
          return (
            <Pressable
              key={i.id}
              accessibilityRole="radio"
              accessibilityState={{ selected: current }}
              disabled={choose.isPending}
              onPress={() => choose.mutate(i.id, { onSuccess: () => router.back() })}
              style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: space.md, padding: space.lg, opacity: pressed ? 0.6 : 1 })}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ fontSize: 16, fontWeight: "700", color: c.text }}>{i.title}</Text>
                {i.contactName ? <Text style={{ fontSize: 13, color: c.textMuted }}>for {i.contactName}</Text> : null}
              </View>
              <Ionicons name={current ? "radio-button-on" : "radio-button-off"} size={22} color={current ? c.forest : c.border} />
            </Pressable>
          );
        })}
      </Rows>
    </Screen>
  );
}
