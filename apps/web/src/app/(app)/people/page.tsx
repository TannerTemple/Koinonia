"use client";

import { Plus, Search, UserSearch, Users } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { dayInTimezone, dueStatus, type Contact } from "@koinonia/shared";
import { ContactList } from "@/components/contacts";
import { Button, EmptyState, ErrorState, Input, PageHeader, Spinner } from "@/components/ui";
import { useUser } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { useContacts } from "@/lib/hooks";

type Filter = "all" | "due" | "none" | "archived";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "Everyone" },
  { key: "due", label: "Due" },
  { key: "none", label: "No reminder" },
  { key: "archived", label: "Archived" },
];

export default function PeoplePage() {
  const user = useUser();
  const today = dayInTimezone(new Date(), user.timezone);
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const { data, error, isPending, refetch } = useContacts({ archived: filter === "archived" });

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (data ?? []).filter((c: Contact) => {
      if (needle && !`${c.name} ${c.relationship ?? ""}`.toLowerCase().includes(needle)) return false;
      const status = dueStatus(c.dueDay, today);
      if (filter === "due") return status === "overdue" || status === "today";
      if (filter === "none") return status === "none";
      return true;
    });
  }, [data, q, filter, today]);

  return (
    <>
      <PageHeader
        title="People"
        subtitle={data ? `${data.length} ${data.length === 1 ? "person" : "people"}${filter === "archived" ? " archived" : " you're keeping up with"}` : undefined}
        action={
          <div className="flex gap-2">
            <Link href="/people/find">
              <Button variant="secondary">
                <UserSearch className="size-4" aria-hidden /> Find
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
      <div className="mb-4 space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <Input type="search" aria-label="Search people" placeholder="Search by name or relationship" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter people">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              aria-pressed={filter === f.key}
              onClick={() => setFilter(f.key)}
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
            body="Add the people you want to stay close to. On your phone, the Koinonia app can import them straight from your contacts."
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
        <ContactList contacts={visible} today={today} actions={false} />
      )}
    </>
  );
}
