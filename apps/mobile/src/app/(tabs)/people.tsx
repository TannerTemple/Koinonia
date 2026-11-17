import { router } from "expo-router";
import { useMemo, useState } from "react";
import { TextInput, View } from "react-native";
import { BRAND, PEOPLE_PAGE, filterPeople, groupsInUse, type PeopleFilter } from "@koinonia/shared";
import { ContactRow } from "@/components/domain";
import { Body, Button, Chip, ChipRow, EmptyState, ErrorState, Loading, Rows, Screen, Title } from "@/components/ui";
import { useContacts, useRefresh, useToday } from "@/lib/hooks";
import { radius, space, useTheme } from "@/lib/theme";

export default function PeopleScreen() {
  const { c } = useTheme();
  const today = useToday();
  const [filter, setFilter] = useState<PeopleFilter>("all");
  const [q, setQ] = useState("");
  const [shown, setShown] = useState(PEOPLE_PAGE);
  const { data, error, isPending, refetch } = useContacts({ archived: filter === "archived" });
  const active = useContacts();
  const refresh = useRefresh(refetch);

  const visible = useMemo(() => filterPeople(data ?? [], { q, filter, today }), [data, q, filter, today]);
  // The group chips come from the groups people are actually in.
  const filters: [PeopleFilter, string][] = [
    ["all", "Everyone"],
    ["due", "Due"],
    ["favorites", "★ Favorites"],
    ...groupsInUse(active.data ?? []).map((g): [PeopleFilter, string] => [`group:${g}`, g]),
    ["archived", "Archived"],
  ];
  const pick = (next: PeopleFilter) => {
    setFilter(next);
    setShown(PEOPLE_PAGE);
  };

  if (error) return <ErrorState error={error} onRetry={refetch} />;

  const hasPeople = !data || data.length > 0;

  return (
    <Screen topInset {...refresh}>
      <View style={{ gap: space.md }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Title>People</Title>
          <Button small icon="add" label="Add" accessibilityLabel="Add a person" onPress={() => router.push("/contact/form")} />
        </View>
        {/* With nobody on the list there is nothing to search or filter. */}
        {hasPeople ? (
          <>
        <TextInput
          accessibilityLabel="Search people"
          placeholder="Search by name, group or phone"
          placeholderTextColor={c.textMuted}
          value={q}
          onChangeText={(t) => {
            setQ(t);
            setShown(PEOPLE_PAGE);
          }}
          clearButtonMode="while-editing"
          autoCorrect={false}
          style={{ minHeight: 44, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, color: c.text, paddingHorizontal: space.md, fontSize: 16 }}
        />
        <ChipRow>
          {filters.map(([key, label]) => (
            <Chip key={key} label={label} selected={filter === key} onPress={() => pick(key)} />
          ))}
        </ChipRow>
          </>
        ) : null}
      </View>

      {isPending ? (
        <Loading />
      ) : visible.length > 0 ? (
        <View style={{ gap: space.md }}>
          <Rows>{visible.slice(0, shown).map((p) => <ContactRow key={p.id} contact={p} today={today} />)}</Rows>
          {visible.length > shown ? <Button variant="secondary" label={`Show more (${visible.length - shown} more)`} onPress={() => setShown((n) => n + PEOPLE_PAGE)} /> : null}
        </View>
      ) : data.length === 0 && filter === "all" ? (
        <EmptyState icon="people" title="No one here yet" body="Add the people you want to stay close to, or bring them in from your phone's contacts." />
      ) : (
        <EmptyState title="No matches" body="Nobody fits that search or filter." />
      )}

      <View style={{ gap: space.sm }}>
        <Button variant="secondary" icon="download-outline" label="Import from my contacts" onPress={() => router.push("/contact/import")} />
        {hasPeople ? <Button variant="secondary" icon="search" label={`Find people on ${BRAND.name}`} onPress={() => router.push("/contact/find")} /> : null}
        {data && hasPeople ? (
          <Body muted style={{ textAlign: "center", fontSize: 13 }}>
            {data.length} {data.length === 1 ? "person" : "people"}
          </Body>
        ) : null}
      </View>
    </Screen>
  );
}
