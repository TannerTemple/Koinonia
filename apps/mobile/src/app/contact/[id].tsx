import { Ionicons } from "@expo/vector-icons";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { Alert, Linking, Pressable, Share, Text, View } from "react-native";
import {
  CHANNEL_LABELS,
  MESSAGE_STARTERS,
  cadenceLabel,
  contactLink,
  dueStatus,
  fillStarter,
  formatDay,
  relativeDay,
  type Channel,
  type ContactDetail,
  type Interaction,
  type Note,
} from "@koinonia/shared";
import { DueBadge, IntentionRow } from "@/components/domain";
import { Avatar, Badge, Body, Button, Card, ErrorState, IconButton, Loading, Rows, Screen, SectionTitle, Title, type IconName } from "@/components/ui";
import { api } from "@/lib/api";
import { useAction, useContact, useRefresh, useToday } from "@/lib/hooks";
import { radius, space, useTheme } from "@/lib/theme";

function QuickAction({ contact, channel, icon }: { contact: ContactDetail; channel: Channel; icon: IconName }) {
  const { c } = useTheme();
  const href = contactLink(channel, contact);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${CHANNEL_LABELS[channel]} ${contact.name}`}
      accessibilityState={{ disabled: !href }}
      disabled={!href}
      onPress={() => href && void Linking.openURL(href).catch(() => Alert.alert("Couldn't open that", "This device can't start that kind of message."))}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: 60,
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: c.border,
        backgroundColor: c.surface,
        opacity: !href ? 0.4 : pressed ? 0.7 : 1,
      })}
    >
      <Ionicons name={icon} size={20} color={c.primary} />
      <Text style={{ fontSize: 13, fontWeight: "700", color: c.primary }}>{CHANNEL_LABELS[channel]}</Text>
    </Pressable>
  );
}

function NoteCard({ note, today }: { note: Note; today: string }) {
  const { c } = useTheme();
  const update = useAction((input: Parameters<typeof api.notes.update>[1]) => api.notes.update(note.id, input));
  const remove = useAction(() => api.notes.delete(note.id));
  const open = note.followUpDay && !note.followUpDone;
  return (
    <Card style={{ padding: space.md, gap: space.sm }}>
      <Text style={{ fontSize: 16, lineHeight: 22, color: c.text }}>{note.body}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {note.pinned ? <Badge tone="gold" icon="pin" label="Pinned" /> : null}
        {open ? (
          <Badge tone={note.followUpDay! <= today ? "danger" : "primary"} icon="calendar-outline" label={`Follow up ${relativeDay(note.followUpDay!, today)}`} />
        ) : note.followUpDay ? (
          <Badge icon="checkmark" label="Followed up" />
        ) : null}
      </View>
      <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
        {open ? <IconButton icon="checkmark-circle-outline" label="Mark follow-up done" onPress={() => update.mutate({ followUpDone: true })} /> : null}
        <IconButton icon={note.pinned ? "pin" : "pin-outline"} label={note.pinned ? "Unpin note" : "Pin note"} onPress={() => update.mutate({ pinned: !note.pinned })} />
        <IconButton icon="create-outline" label="Edit note" onPress={() => router.push(`/note?id=${note.id}&contactId=${note.contactId}`)} />
        <IconButton
          icon="trash-outline"
          label="Delete note"
          onPress={() =>
            Alert.alert("Delete this note?", undefined, [
              { text: "Cancel", style: "cancel" },
              { text: "Delete", style: "destructive", onPress: () => remove.mutate(undefined) },
            ])
          }
        />
      </View>
    </Card>
  );
}

function HistoryRow({ item, today }: { item: Interaction; today: string }) {
  const { c } = useTheme();
  const remove = useAction(() => api.contacts.deleteInteraction(item.id));
  return (
    <View style={{ flexDirection: "row", alignItems: "center", paddingLeft: space.md, paddingRight: space.sm, paddingVertical: space.sm, gap: space.md }}>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.primary }} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontSize: 15, fontWeight: "700", color: c.text }}>
          {CHANNEL_LABELS[item.channel]} <Text style={{ fontWeight: "400", color: c.textMuted }}>· {formatDay(item.day, today)} ({relativeDay(item.day, today)})</Text>
        </Text>
        {item.summary ? <Text style={{ fontSize: 14, lineHeight: 20, color: c.textMuted }}>{item.summary}</Text> : null}
      </View>
      <IconButton
        icon="close"
        label="Remove this reach-out"
        onPress={() =>
          Alert.alert("Remove this reach-out?", "The reminder will be recalculated.", [
            { text: "Cancel", style: "cancel" },
            { text: "Remove", style: "destructive", onPress: () => remove.mutate(undefined) },
          ])
        }
      />
    </View>
  );
}

export default function ContactScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c } = useTheme();
  const today = useToday();
  const { data: contact, error, isPending, refetch } = useContact(id);
  const refresh = useRefresh(refetch);
  const snooze = useAction((input: Parameters<typeof api.contacts.snooze>[1]) => api.contacts.snooze(id, input));

  if (isPending) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  const first = contact.name.split(" ")[0];
  const status = dueStatus(contact.dueDay, today);
  const snoozed = Boolean(contact.snoozedUntilDay && contact.snoozedUntilDay > today && contact.dueDay === contact.snoozedUntilDay);
  const messageChannel: Channel | null = contact.phone ? "TEXT" : contact.email ? "EMAIL" : null;

  const sendStarter = (text: string) => {
    const href = messageChannel ? contactLink(messageChannel, contact, text) : null;
    if (href) void Linking.openURL(href).catch(() => void Share.share({ message: text }));
    else void Share.share({ message: text });
  };

  return (
    <Screen {...refresh}>
      <Stack.Screen options={{ headerRight: () => <IconButton icon="create-outline" label={`Edit ${contact.name}`} color={c.primary} onPress={() => router.push(`/contact/form?id=${id}`)} /> }} />

      <View style={{ gap: space.md }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.lg }}>
          <Avatar name={contact.name} size={68} />
          <View style={{ flex: 1, gap: 4 }}>
            <Title style={{ fontSize: 28 }}>{contact.name}</Title>
            {contact.relationship ? <Body muted>{contact.relationship}</Body> : null}
          </View>
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          <DueBadge contact={contact} today={today} />
          <Badge label={cadenceLabel(contact.cadenceDays)} />
          {contact.birthday ? <Badge tone="gold" icon="gift-outline" label={formatDay(contact.birthday.length === 5 ? `2000-${contact.birthday}` : contact.birthday, contact.birthday.slice(0, 4))} /> : null}
          {contact.linkedUserId ? <Badge tone="forest" label="On Koinonia" /> : null}
          {contact.archived ? <Badge label="Archived" /> : null}
        </View>
        <Body muted style={{ fontSize: 14 }}>
          {contact.lastContactedDay ? `You last reached out ${relativeDay(contact.lastContactedDay, today)}.` : "No reach-outs logged yet."}
          {snoozed ? ` Snoozed until ${formatDay(contact.snoozedUntilDay!, today)}.` : ""}
        </Body>
        <View style={{ flexDirection: "row", gap: space.sm }}>
          <QuickAction contact={contact} channel="CALL" icon="call" />
          <QuickAction contact={contact} channel="TEXT" icon="chatbubble" />
          <QuickAction contact={contact} channel="EMAIL" icon="mail" />
        </View>
        <Button icon="checkmark" label="I reached out" onPress={() => router.push(`/contact/reach-out?id=${id}`)} />
        {snoozed ? (
          <Button variant="secondary" label="Unsnooze" loading={snooze.isPending} onPress={() => snooze.mutate({ clear: true })} />
        ) : status === "overdue" || status === "today" ? (
          <View style={{ flexDirection: "row", gap: space.sm }}>
            <Button variant="secondary" icon="alarm-outline" label="Tomorrow" style={{ flex: 1 }} disabled={snooze.isPending} onPress={() => snooze.mutate({ days: 1 })} />
            <Button variant="secondary" label="Next week" style={{ flex: 1 }} disabled={snooze.isPending} onPress={() => snooze.mutate({ days: 7 })} />
          </View>
        ) : null}
      </View>

      <View>
        <SectionTitle count={contact.notes.length} action={<Button small variant="ghost" icon="add" label="Add note" onPress={() => router.push(`/note?contactId=${id}`)} />}>
          Notes
        </SectionTitle>
        {contact.notes.length ? (
          <View style={{ gap: space.sm }}>
            {contact.notes.map((n) => (
              <NoteCard key={n.id} note={n} today={today} />
            ))}
          </View>
        ) : (
          <Body muted>What do you want to remember about {first}? What should you ask next time?</Body>
        )}
      </View>

      <View>
        <SectionTitle tone="forest" count={contact.intentions.length} action={<Button small variant="ghost" icon="add" label="Add" accessibilityLabel={`Add an intention for ${first}`} onPress={() => router.push(`/intention?contactId=${id}`)} />}>
          {`Praying for ${first}`}
        </SectionTitle>
        {contact.intentions.length ? (
          <Rows>{contact.intentions.map((i) => <IntentionRow key={i.id} intention={i} today={today} showContact={false} />)}</Rows>
        ) : (
          <Body muted>Did you tell {first} you&rsquo;d pray for something? Add it so you don&rsquo;t forget.</Body>
        )}
      </View>

      <View>
        <SectionTitle>Not sure what to say?</SectionTitle>
        <Rows>
          {MESSAGE_STARTERS.map((template) => {
            const text = fillStarter(template, contact.name);
            return (
              <Pressable key={template} accessibilityRole="button" accessibilityLabel={`Send: ${text}`} onPress={() => sendStarter(text)} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: space.md, padding: space.md, opacity: pressed ? 0.6 : 1 })}>
                <Text style={{ flex: 1, fontSize: 15, lineHeight: 21, color: c.text }}>{text}</Text>
                <Ionicons name="send" size={18} color={c.primary} />
              </Pressable>
            );
          })}
        </Rows>
      </View>

      <View>
        <SectionTitle count={contact.interactions.length}>History</SectionTitle>
        {contact.interactions.length ? <Rows>{contact.interactions.map((i) => <HistoryRow key={i.id} item={i} today={today} />)}</Rows> : <Body muted>Each time you reach out, it lands here.</Body>}
      </View>
    </Screen>
  );
}
