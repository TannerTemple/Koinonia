"use client";

import { FileUp, Plus, Search, UserSearch, Users } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { BRAND, PEOPLE_PAGE, dayInTimezone, filterPeople, groupsInUse, type PeopleFilter } from "@koinonia/shared";
import { ContactList } from "@/components/contacts";
import { Button, EmptyState, ErrorState, Input, PageHeader, Spinner } from "@/components/ui";
import { useUser } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { useContacts } from "@/lib/hooks";

export default function PeoplePage() {
  const user = useUser();
  const today = dayInTimezone(new Date(), user.timezone);
  const [filter, setFilter] = useState<PeopleFilter>("all");
  const [q, setQ] = useState("");
  const [shown, setShown] = useState(PEOPLE_PAGE);
  const { data, error, isPending, refetch } = useContacts({ archived: filter === "archived" });

  const visible = useMemo(() => filterPeople(data ?? [], { q, filter, today }), [data, q, filter, today]);
  // The group chips come from the groups people are actually in.
  const active = useContacts();
  const filters: { key: PeopleFilter; label: string }[] = [
    { key: "all", label: "Everyone" },
    { key: "due", label: "Due" },
    { key: "favorites", label: "★ Favorites" },
    ...groupsInUse(active.data ?? []).map((g) => ({ key: `group:${g}` as PeopleFilter, label: g })),
    { key: "archived", label: "Archived" },
  ];
  const pick = (next: PeopleFilter) => {
    setFilter(next);
    setShown(PEOPLE_PAGE);
  };

  return (
    <>
      <PageHeader
        title="People"
        subtitle={data?.length ? `${data.length} ${data.length === 1 ? "person" : "people"}${filter === "archived" ? " archived" : " you're keeping up with"}` : undefined}
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/people/find" className={cn(data?.length === 0 && "hidden")}>
              <Button variant="secondary">
                <UserSearch className="size-4" aria-hidden /> Find
              </Button>
            </Link>
            <Link href="/people/import">
              <Button variant="secondary">
                <FileUp className="size-4" aria-hidden /> Import
              </Button>
            </Link>
            <Link href="/people/new">
              <Button>
                <Plus className="size-4" aria-hidden /> Add person
              </Button>
            </Link>
          </div>
        }
      />
      {/* With nobody on the list there is nothing to search or filter. */}
      <div className={cn("mb-4 space-y-3", data?.length === 0 && "hidden")}>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <Input type="search" aria-label="Search people" placeholder="Search by name, group, phone or email" value={q} onChange={(e) => { setQ(e.target.value); setShown(PEOPLE_PAGE); }} className="pl-9" />
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter people">
          {filters.map((f) => (
            <button
              key={f.key}
              type="button"
              aria-pressed={filter === f.key}
              onClick={() => pick(f.key)}
              className={cn(
                "h-9 rounded-full border px-3.5 text-sm font-semibold transition-colors",
                filter === f.key ? "border-primary bg-primary text-on-primary" : "border-border bg-surface hover:bg-surface-alt",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {isPending ? (
        <Spinner />
      ) : error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : visible.length === 0 ? (
        data.length === 0 && filter === "all" ? (
          <EmptyState
            icon={<Users className="size-6" />}
            title="No one here yet"
            body={`Add the people you want to stay close to, or import them from a contacts file. On your phone, the ${BRAND.name} app can import them straight from your address book.`}
            action={
              <Link href="/people/new">
                <Button>Add your first person</Button>
              </Link>
            }
          />
        ) : (
          <EmptyState title="No matches" body="Nobody fits that search or filter." />
        )
      ) : (
        <>
          <ContactList contacts={visible.slice(0, shown)} today={today} />
          {visible.length > shown ? (
            <div className="mt-4 text-center">
              <Button variant="secondary" onClick={() => setShown((n) => n + PEOPLE_PAGE)}>
                Show more ({visible.length - shown} more)
              </Button>
            </div>
          ) : null}
        </>
      )}
    </>
  );
}
