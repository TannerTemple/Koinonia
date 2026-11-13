import { router } from "expo-router";
import { useMemo, useState } from "react";
import { TextInput, View } from "react-native";
import { dueStatus } from "@koinonia/shared";
import { ContactRow } from "@/components/domain";
import { Body, Button, Chip, ChipRow, EmptyState, ErrorState, Loading, Rows, Screen, Title } from "@/components/ui";
import { useContacts, useRefresh, useToday } from "@/lib/hooks";
import { radius, space, useTheme } from "@/lib/theme";

type Filter = "all" | "due" | "none" | "archived";
const FILTERS: [Filter, string][] = [
  ["all", "Everyone"],
  ["due", "Due"],
  ["none", "No reminder"],
  ["archived", "Archived"],
];

export default function PeopleScreen() {
  const { c } = useTheme();
  const today = useToday();
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const { data, error, isPending, refetch } = useContacts({ archived: filter === "archived" });
  const refresh = useRefresh(refetch);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (data ?? []).filter((p) => {
      if (needle && !`${p.name} ${p.relationship ?? ""}`.toLowerCase().includes(needle)) return false;
      const status = dueStatus(p.dueDay, today);
      if (filter === "due") return status === "overdue" || status === "today";
      if (filter === "none") return status === "none";
      return true;
    });
  }, [data, q, filter, today]);

  if (error) return <ErrorState error={error} onRetry={refetch} />;

  return (
    <Screen topInset {...refresh}>
      <View style={{ gap: space.md }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Title>People</Title>
          <Button small icon="add" label="Add" accessibilityLabel="Add a person" onPress={() => router.push("/contact/form")} />
        </View>
        <TextInput
          accessibilityLabel="Search people"
          placeholder="Search by name or relationship"
          placeholderTextColor={c.textMuted}
          value={q}
          onChangeText={setQ}
          clearButtonMode="while-editing"
          autoCorrect={false}
          style={{ minHeight: 44, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, color: c.text, paddingHorizontal: space.md, fontSize: 16 }}
        />
        <ChipRow>
          {FILTERS.map(([key, label]) => (
            <Chip key={key} label={label} selected={filter === key} onPress={() => setFilter(key)} />
          ))}
        </ChipRow>
      </View>

      {isPending ? (
        <Loading />
      ) : visible.length > 0 ? (
        <Rows>{visible.map((p) => <ContactRow key={p.id} contact={p} today={today} />)}</Rows>
      ) : data.length === 0 && filter === "all" ? (
        <EmptyState icon="people" title="No one here yet" body="Add the people you want to stay close to, or bring them in from your phone's contacts." />
      ) : (
        <EmptyState title="No matches" body="Nobody fits that search or filter." />
      )}

      <View style={{ gap: space.sm }}>
        <Button variant="secondary" icon="download-outline" label="Import from my contacts" onPress={() => router.push("/contact/import")} />
        <Button variant="secondary" icon="search" label="Find people on Koinonia" onPress={() => router.push("/contact/find")} />
        {data ? (
          <Body muted style={{ textAlign: "center", fontSize: 13 }}>
            {data.length} {data.length === 1 ? "person" : "people"}
          </Body>
        ) : null}
      </View>
    </Screen>
  );
}
