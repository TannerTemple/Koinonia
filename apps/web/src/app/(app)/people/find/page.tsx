"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Check, Search, UserPlus } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { UserSearchResult } from "@koinonia/shared";
import { Avatar, Badge, Button, EmptyState, ErrorState, Input, PageHeader, Spinner } from "@/components/ui";
import { api } from "@/lib/api";
import { useAction } from "@/lib/hooks";

function Result({ result }: { result: UserSearchResult }) {
  const add = useAction(() =>
    api.contacts.create({ name: result.name, email: result.email, phone: result.phone, linkedUserId: result.id, cadenceDays: 14 }),
  );
  const added = result.alreadyContact || add.isSuccess;
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <Avatar name={result.name} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{result.name}</p>
        <p className="truncate text-sm text-muted">{result.email ?? result.phone ?? "Koinonia member"}</p>
      </div>
      {added ? (
        <Badge tone="forest">
          <Check className="size-3" aria-hidden /> In your people
        </Badge>
      ) : (
        <Button size="sm" loading={add.isPending} onClick={() => add.mutate(undefined)}>
          <UserPlus className="size-4" aria-hidden /> Add
        </Button>
      )}
    </li>
  );
}

export default function FindPeoplePage() {
  const [input, setInput] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setQ(input.trim()), 300);
    return () => clearTimeout(t);
  }, [input]);

  const { data, error, isFetching, refetch } = useQuery({
    queryKey: ["userSearch", q],
    queryFn: () => api.users.search(q),
    enabled: q.length >= 2,
  });

  const invite = `I'm using Koinonia to stay in touch with the people who matter to me. Join me: ${typeof window === "undefined" ? "" : window.location.origin}/register`;

  return (
    <>
      <Link href="/people" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-text">
        <ArrowLeft className="size-4" aria-hidden /> People
      </Link>
      <PageHeader title="Find people on Koinonia" subtitle="Search by name, or by exact email or phone number." />
      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
        <Input type="search" aria-label="Search members" autoFocus placeholder="Maria Lopez, maria@example.com or (555) 010-2000" value={input} onChange={(e) => setInput(e.target.value)} className="pl-9" />
      </div>

      {q.length < 2 ? (
        <EmptyState title="Look someone up" body="Type at least two letters. People who turned off discovery in their settings won't appear." />
      ) : error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : !data && isFetching ? (
        <Spinner label="Searching" />
      ) : data && data.length > 0 ? (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
          {data.map((r) => (
            <Result key={r.id} result={r} />
          ))}
        </ul>
      ) : (
        <EmptyState
          title="No one by that name yet"
          body="They may not be on Koinonia. You can still add them yourself, or send them an invitation."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Link href="/people/new">
                <Button variant="secondary">Add them manually</Button>
              </Link>
              <a href={`mailto:?subject=${encodeURIComponent("Join me on Koinonia")}&body=${encodeURIComponent(invite)}`}>
                <Button>Invite by email</Button>
              </a>
            </div>
          }
        />
      )}
    </>
  );
}
