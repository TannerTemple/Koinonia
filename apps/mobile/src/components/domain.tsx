import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import {
  INTENTION_KIND_LABELS,
  cadenceLabel,
  dueLabel,
  dueStatus,
  relativeDay,
  type Contact,
  type Intention,
  type PrayerToday,
} from "@koinonia/shared";
import { api } from "@/lib/api";
import { showDialog } from "@/lib/dialog";
import { useAction } from "@/lib/hooks";
import { radius, serif, space, useTheme } from "@/lib/theme";
import { Avatar, Badge, Button, IconButton, type BadgeTone } from "./ui";

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------
export function DueBadge({ contact, today }: { contact: Contact; today: string }) {
  const status = dueStatus(contact.dueDay, today);
  if (status === "none") return <Badge label="No reminder" />;
  const tone: BadgeTone = ({ overdue: "danger", today: "gold", soon: "primary", later: "neutral" } as const)[status];
  return <Badge tone={tone} label={dueLabel(contact.dueDay, today)} />;
}

/** A person in a list: tap to open. */
export function ContactRow({ contact, today }: { contact: Contact; today: string }) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${contact.favorite ? "Favorite. " : ""}${contact.name}, ${dueLabel(contact.dueDay, today)}`}
      onPress={() => router.push(`/contact/${contact.id}`)}
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: space.md, padding: space.md, opacity: pressed ? 0.6 : 1 })}
    >
      <Avatar name={contact.name} />
      <View style={{ flex: 1, gap: 3 }}>
        <Text numberOfLines={1} style={{ fontSize: 17, fontWeight: "700", color: c.text }}>
          {contact.favorite ? <Text style={{ color: c.gold }}>★ </Text> : null}
          {contact.name}
        </Text>
        <Text numberOfLines={1} style={{ fontSize: 14, color: c.textMuted }}>
          {contact.groups.length ? `${contact.groups.join(", ")} · ` : ""}
          {cadenceLabel(contact.cadenceDays)}
          {contact.lastContactedDay ? ` · last ${relativeDay(contact.lastContactedDay, today)}` : ""}
        </Text>
      </View>
      <DueBadge contact={contact} today={today} />
    </Pressable>
  );
}

/** Someone who is due: who, how late, and the two things you can do about it, in words. */
export function ReachOutCard({ contact, today }: { contact: Contact; today: string }) {
  const { c } = useTheme();
  const late = dueStatus(contact.dueDay, today) === "overdue";
  const notToday = useAction(() => api.contacts.snooze(contact.id, { days: 1 }));
  return (
    <View style={{ backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: late ? c.danger : c.border, padding: space.md, gap: space.md }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${contact.name}, ${dueLabel(contact.dueDay, today)}. Open.`}
        onPress={() => router.push(`/contact/${contact.id}`)}
        style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: space.md, opacity: pressed ? 0.6 : 1 })}
      >
        <Avatar name={contact.name} size={48} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text numberOfLines={2} style={{ fontSize: 19, lineHeight: 24, fontWeight: "700", color: c.text }}>
            {contact.name}
          </Text>
          <Text style={{ fontSize: 15, fontWeight: "600", color: late ? c.danger : c.textMuted }}>
            {dueLabel(contact.dueDay, today)}
            {contact.lastContactedDay ? ` · last talked ${relativeDay(contact.lastContactedDay, today)}` : ""}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
      </Pressable>
      <View style={{ flexDirection: "row", gap: space.sm }}>
        <Button icon="checkmark" label="I reached out" accessibilityLabel={`I reached out to ${contact.name}`} style={{ flex: 1.4 }} onPress={() => router.push(`/contact/reach-out?id=${contact.id}`)} />
        <Button variant="secondary" label="Not today" accessibilityLabel={`Not today: remind me about ${contact.name} tomorrow`} style={{ flex: 1 }} loading={notToday.isPending} onPress={() => notToday.mutate(undefined)} />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Prayer
// ---------------------------------------------------------------------------
export function Hero({ tone, children }: { tone: "blue" | "forest"; children: React.ReactNode }) {
  const colors = tone === "blue" ? (["#2A4590", "#1B2F66", "#131F47"] as const) : (["#1F5540", "#143B2B", "#0D2A1E"] as const);
  return (
    <LinearGradient colors={colors} start={{ x: 0.9, y: 0 }} end={{ x: 0.2, y: 1 }} style={{ borderRadius: radius.lg, padding: space.xl, gap: space.sm }}>
      {children}
    </LinearGradient>
  );
}

export function PrayTodayCard({ prayer, onChoose }: { prayer: PrayerToday; onChoose?: () => void }) {
  const { c } = useTheme();
  const intention = prayer.intention;
  const pray = useAction((id: string) => api.intentions.pray(id));

  return (
    <Hero tone="forest">
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Ionicons name="sparkles" size={14} color={c.onHeroMuted} />
        <Text style={{ color: c.onHeroMuted, fontSize: 12, fontWeight: "800", letterSpacing: 1.4 }}>PRAY TODAY FOR</Text>
      </View>
      {intention ? (
        <>
          <Text accessibilityRole="header" style={{ fontFamily: serif, color: c.onHero, fontSize: 26, lineHeight: 31, fontWeight: "700" }}>
            {intention.title}
          </Text>
          {intention.contactName ? <Text style={{ color: c.onHeroMuted, fontSize: 16 }}>for {intention.contactName}</Text> : null}
          {intention.details ? (
            <Text numberOfLines={4} style={{ color: c.onHeroMuted, fontSize: 15, lineHeight: 21 }}>
              {intention.details}
            </Text>
          ) : null}
          <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space.sm, marginTop: space.sm }}>
            {intention.prayedToday ? (
              <View style={{ minHeight: 48, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: space.lg, borderRadius: radius.md, backgroundColor: "rgba(255,255,255,0.16)" }}>
                <Ionicons name="checkmark" size={18} color={c.onHero} />
                <Text style={{ color: c.onHero, fontWeight: "700", fontSize: 16 }}>Prayed today</Text>
              </View>
            ) : (
              <Button
                variant="onHero"
                icon="heart"
                label="I prayed"
                loading={pray.isPending}
                onPress={() => {
                  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  pray.mutate(intention.id);
                }}
              />
            )}
            {onChoose ? (
              <Pressable accessibilityRole="button" onPress={onChoose} style={{ minHeight: 48, justifyContent: "center", paddingHorizontal: space.md }}>
                <Text style={{ color: c.onHeroMuted, fontWeight: "700", fontSize: 15 }}>Choose another</Text>
              </Pressable>
            ) : null}
          </View>
          <Text style={{ color: c.onHeroMuted, fontSize: 13 }}>{prayer.chosenByUser ? "You chose this for today." : "Picked for you because it has waited the longest."}</Text>
        </>
      ) : (
        <>
          <Text accessibilityRole="header" style={{ fontFamily: serif, color: c.onHero, fontSize: 24, fontWeight: "700" }}>
            Your prayer list is empty
          </Text>
          <Text style={{ color: c.onHeroMuted, fontSize: 15, lineHeight: 21 }}>Add a person, or anything on your heart. Each day one will be set apart for you here.</Text>
          <Button variant="onHero" label="Add to prayer list" style={{ alignSelf: "flex-start", marginTop: space.sm }} onPress={() => router.push("/intention")} />
        </>
      )}
    </Hero>
  );
}

export function IntentionRow({ intention, today, isToday, showContact = true }: { intention: Intention; today: string; isToday?: boolean; showContact?: boolean }) {
  const { c } = useTheme();
  const active = intention.status === "ACTIVE";
  const pray = useAction(() => (intention.prayedToday ? api.intentions.unpray(intention.id) : api.intentions.pray(intention.id)));
  const setToday = useAction(() => api.prayer.setToday(intention.id));
  const update = useAction((status: Intention["status"]) => api.intentions.update(intention.id, { status }));
  const remove = useAction(() => api.intentions.delete(intention.id));

  const openMenu = () =>
    showDialog(intention.title, undefined, [
      ...(active && !isToday ? [{ text: "Pray for this today", onPress: () => setToday.mutate(undefined) }] : []),
      active ? { text: "Mark answered", onPress: () => update.mutate("ANSWERED") } : { text: "Pray again", onPress: () => update.mutate("ACTIVE") },
      ...(active ? [{ text: "Archive", onPress: () => update.mutate("ARCHIVED") }] : []),
      { text: "Edit", onPress: () => router.push(`/intention?id=${intention.id}`) },
      { text: "Delete", style: "destructive" as const, onPress: () => remove.mutate(undefined) },
      { text: "Cancel", style: "cancel" as const },
    ]);

  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: space.md, padding: space.md }}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: intention.prayedToday, disabled: !active }}
        accessibilityLabel={`I prayed for ${intention.title} today`}
        disabled={!active || pray.isPending}
        hitSlop={6}
        onPress={() => {
          if (!intention.prayedToday) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          pray.mutate(undefined);
        }}
        style={{
          width: 38,
          height: 38,
          borderRadius: 19,
          borderWidth: 2,
          borderColor: intention.prayedToday ? c.forest : c.border,
          backgroundColor: intention.prayedToday ? c.forest : "transparent",
          alignItems: "center",
          justifyContent: "center",
          opacity: active ? 1 : 0.4,
        }}
      >
        <Ionicons name={intention.prayedToday ? "checkmark" : "heart-outline"} size={18} color={intention.prayedToday ? c.onPrimary : c.textMuted} />
      </Pressable>
      <View style={{ flex: 1, gap: 6 }}>
        <Text style={{ fontSize: 16, fontWeight: "700", color: active ? c.text : c.textMuted }}>{intention.title}</Text>
        {intention.details ? (
          <Text numberOfLines={3} style={{ fontSize: 14, lineHeight: 20, color: c.textMuted }}>
            {intention.details}
          </Text>
        ) : null}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
          {isToday ? <Badge tone="forest" icon="star" label="Today's prayer" /> : null}
          {showContact && intention.contactName ? <Badge tone="primary" label={intention.contactName} /> : null}
          {!showContact || !intention.contactName ? <Badge label={INTENTION_KIND_LABELS[intention.kind]} /> : null}
          {intention.status === "ANSWERED" ? <Badge tone="gold" label="Answered" /> : null}
        </View>
        <Text style={{ fontSize: 12, color: c.textMuted }}>
          {!active
            ? intention.prayedCount ? `Prayed ${intention.prayedCount} ${intention.prayedCount === 1 ? "time" : "times"}` : ""
            : intention.prayedToday
              ? `Prayed today · ${intention.prayedCount} ${intention.prayedCount === 1 ? "time" : "times"} in all`
              : intention.prayedCount === 0
                ? "Tap the circle when you've prayed"
                : `Prayed ${intention.prayedCount} ${intention.prayedCount === 1 ? "time" : "times"} · last ${relativeDay(intention.lastPrayedDay!, today)}`}
        </Text>
      </View>
      <IconButton icon="ellipsis-horizontal" label={`More options for ${intention.title}`} onPress={openMenu} />
    </View>
  );
}

/** Kept for screens that still import the old name. */
export const DailyIntentionCard = PrayTodayCard;
