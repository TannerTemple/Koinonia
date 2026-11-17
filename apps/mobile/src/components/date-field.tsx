import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { formatLongDay, type Day } from "@koinonia/shared";
import { MONTH_NAMES, WEEKDAY_INITIALS, monthGrid, monthInRange, shiftMonth } from "@/lib/calendar";
import { radius, serif, space, useTheme } from "@/lib/theme";
import { IconButton, Label } from "./ui";

interface DateFieldProps {
  label: string;
  value: Day | null;
  onChange: (day: Day | null) => void;
  today: Day;
  /** Earliest / latest selectable day (inclusive). */
  minDay?: Day;
  maxDay?: Day;
  /** Shown when no day is chosen; also enables the Clear button. */
  emptyLabel?: string;
  hint?: string;
}

/** A date input: shows the chosen day and opens a month calendar to pick one. */
export function DateField({ label, value, onChange, today, minDay, maxDay, emptyLabel, hint }: DateFieldProps) {
  const { c } = useTheme();
  const [open, setOpen] = useState(false);
  const start = value ?? (maxDay && today > maxDay ? maxDay : minDay && today < minDay ? minDay : today);
  const [view, setView] = useState({ year: Number(start.slice(0, 4)), month: Number(start.slice(5, 7)) });

  const show = () => {
    setView({ year: Number(start.slice(0, 4)), month: Number(start.slice(5, 7)) });
    setOpen(true);
  };
  const pick = (day: Day | null) => {
    onChange(day);
    setOpen(false);
  };
  const selectable = (day: Day) => (!minDay || day >= minDay) && (!maxDay || day <= maxDay);
  const prev = shiftMonth(view.year, view.month, -1);
  const next = shiftMonth(view.year, view.month, 1);
  const canPrev = monthInRange(prev.year, prev.month, minDay, maxDay);
  const canNext = monthInRange(next.year, next.month, minDay, maxDay);

  return (
    <View>
      <Label>{label}</Label>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value ? formatLongDay(value) : (emptyLabel ?? "Choose a date")}. Tap to change.`}
        onPress={show}
        style={({ pressed }) => ({
          minHeight: 48,
          flexDirection: "row",
          alignItems: "center",
          gap: space.sm,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: c.border,
          backgroundColor: c.surface,
          paddingHorizontal: space.md,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Ionicons name="calendar-outline" size={18} color={c.primary} />
        <Text style={{ flex: 1, fontSize: 16, color: value ? c.text : c.textMuted }}>
          {value ? (value === today ? `Today, ${formatLongDay(value)}` : formatLongDay(value)) : (emptyLabel ?? "Choose a date")}
        </Text>
        <Ionicons name="chevron-down" size={16} color={c.textMuted} />
      </Pressable>
      {hint ? <Text style={{ color: c.textMuted, fontSize: 13, marginTop: 4 }}>{hint}</Text> : null}

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable accessibilityLabel="Close calendar" onPress={() => setOpen(false)} style={{ flex: 1, backgroundColor: "rgba(10,16,36,0.55)", justifyContent: "center", padding: space.lg }}>
          {/* Taps inside the card must not close it. */}
          <Pressable accessible={false} onPress={() => undefined} style={{ alignSelf: "center", width: "100%", maxWidth: 380, backgroundColor: c.surface, borderRadius: radius.lg, padding: space.lg, gap: space.md }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <IconButton icon="chevron-back" label="Previous month" disabled={!canPrev} onPress={() => setView(prev)} />
              <Text accessibilityRole="header" accessibilityLiveRegion="polite" style={{ flex: 1, textAlign: "center", fontFamily: serif, fontSize: 20, fontWeight: "700", color: c.text }}>
                {MONTH_NAMES[view.month - 1]} {view.year}
              </Text>
              <IconButton icon="chevron-forward" label="Next month" disabled={!canNext} onPress={() => setView(next)} />
            </View>

            <View>
              <View style={{ flexDirection: "row" }}>
                {WEEKDAY_INITIALS.map((d, i) => (
                  <Text key={i} style={{ flex: 1, textAlign: "center", fontSize: 12, fontWeight: "700", color: c.textMuted, paddingBottom: 6 }}>
                    {d}
                  </Text>
                ))}
              </View>
              {monthGrid(view.year, view.month).map((week, w) => (
                <View key={w} style={{ flexDirection: "row" }}>
                  {week.map((day, i) => {
                    if (!day) return <View key={i} style={{ flex: 1, height: 44 }} />;
                    const selected = day === value;
                    const enabled = selectable(day);
                    return (
                      <Pressable
                        key={i}
                        accessibilityRole="button"
                        accessibilityLabel={formatLongDay(day)}
                        accessibilityState={{ selected, disabled: !enabled }}
                        disabled={!enabled}
                        onPress={() => pick(day)}
                        style={{ flex: 1, height: 44, alignItems: "center", justifyContent: "center" }}
                      >
                        <View
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: 19,
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: selected ? c.primary : "transparent",
                            borderWidth: day === today && !selected ? 1.5 : 0,
                            borderColor: c.primary,
                          }}
                        >
                          <Text style={{ fontSize: 16, fontWeight: selected || day === today ? "700" : "400", color: selected ? c.onPrimary : enabled ? c.text : c.textMuted, opacity: enabled ? 1 : 0.4 }}>
                            {Number(day.slice(8))}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </View>

            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View style={{ flexDirection: "row" }}>
                {selectable(today) ? <TextButton label="Today" onPress={() => pick(today)} /> : null}
                {emptyLabel && value ? <TextButton label="Clear" onPress={() => pick(null)} /> : null}
              </View>
              <TextButton label="Cancel" muted onPress={() => setOpen(false)} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function TextButton({ label, onPress, muted }: { label: string; onPress: () => void; muted?: boolean }) {
  const { c } = useTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => ({ minHeight: 44, justifyContent: "center", paddingHorizontal: space.md, opacity: pressed ? 0.6 : 1 })}>
      <Text style={{ fontSize: 16, fontWeight: "700", color: muted ? c.textMuted : c.primary }}>{label}</Text>
    </Pressable>
  );
}
