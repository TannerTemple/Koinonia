"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { AdminUser } from "@koinonia/shared";
import { Badge, Button, Card, ErrorState, FormError, Input, PageHeader, SectionTitle, Spinner } from "@/components/ui";
import { api } from "@/lib/api";
import { useUser } from "@/lib/auth";
import { useAction } from "@/lib/hooks";

function UserRow({ user, isSelf }: { user: AdminUser; isSelf: boolean }) {
  const update = useAction((input: Parameters<typeof api.admin.updateUser>[1]) => api.admin.updateUser(user.id, input));
  return (
    <tr className="border-t border-border align-top">
      <td className="px-4 py-3">
        <p className="font-semibold">{user.name}</p>
        <p className="text-sm text-muted">{user.email}</p>
        <FormError error={update.error} />
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1.5">
          <Badge tone={user.role === "ADMIN" ? "primary" : "neutral"}>{user.role === "ADMIN" ? "Admin" : "User"}</Badge>
          {user.disabled ? <Badge tone="danger">Disabled</Badge> : null}
        </div>
      </td>
      <td className="px-4 py-3 tabular-nums">{user.contactCount}</td>
      <td className="px-4 py-3 tabular-nums">{user.intentionCount}</td>
      <td className="px-4 py-3 text-sm text-muted">{user.lastSeenAt ? new Date(user.lastSeenAt).toLocaleDateString() : "Never"}</td>
      <td className="px-4 py-3">
        {isSelf ? (
          <span className="text-sm text-muted">You</span>
        ) : (
          <div className="flex flex-wrap justify-end gap-2">
            <Button size="sm" variant="secondary" disabled={update.isPending} onClick={() => update.mutate({ role: user.role === "ADMIN" ? "USER" : "ADMIN" })}>
              {user.role === "ADMIN" ? "Remove admin" : "Make admin"}
            </Button>
            <Button size="sm" variant={user.disabled ? "secondary" : "danger"} disabled={update.isPending} onClick={() => update.mutate({ disabled: !user.disabled })}>
              {user.disabled ? "Enable" : "Disable"}
            </Button>
          </div>
        )}
      </td>
    </tr>
  );
}

export default function AdminPage() {
  const me = useUser();
  const router = useRouter();
  const isAdmin = me.role === "ADMIN";
  useEffect(() => {
    if (!isAdmin) router.replace("/");
  }, [isAdmin, router]);

  const [q, setQ] = useState("");
  const stats = useQuery({ queryKey: ["admin", "stats"], queryFn: api.admin.stats, enabled: isAdmin });
  const users = useQuery({ queryKey: ["admin", "users", q], queryFn: () => api.admin.users(q.trim() || undefined), enabled: isAdmin });

  if (!isAdmin) return null;
  if (stats.isPending) return <Spinner />;
  if (stats.error) return <ErrorState error={stats.error} onRetry={stats.refetch} />;

  const s = stats.data;
  const tiles = [
    { label: "Members", value: s.users, sub: `${s.newUsersThisWeek} new this week` },
    { label: "Active this week", value: s.activeUsersThisWeek, sub: "signed in or used the app" },
    { label: "People tracked", value: s.contacts, sub: "across all members" },
    { label: "Reach-outs", value: s.reachOuts, sub: `${s.reachOutsThisWeek} this week` },
    { label: "Intentions", value: s.intentions, sub: "on prayer lists" },
    { label: "Prayers logged", value: s.prayers, sub: "all time" },
  ];

  return (
    <div className="space-y-8">
      <PageHeader title="Admin" subtitle="How Koinonia is being used, and who is using it." />
      <section>
        <SectionTitle>At a glance</SectionTitle>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {tiles.map((t) => (
            <Card key={t.label} className="p-4">
              <p className="text-sm font-semibold text-muted">{t.label}</p>
              <p className="mt-1 text-3xl font-bold tabular-nums">{t.value.toLocaleString()}</p>
              <p className="mt-1 text-sm text-muted">{t.sub}</p>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <SectionTitle count={users.data?.length}>Members</SectionTitle>
        <Input type="search" aria-label="Search members" placeholder="Search by name or email" value={q} onChange={(e) => setQ(e.target.value)} className="mb-3" />
        {users.isPending ? (
          <Spinner />
        ) : users.error ? (
          <ErrorState error={users.error} onRetry={users.refetch} />
        ) : (
          <Card className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left">
              <thead>
                <tr className="text-xs font-bold uppercase tracking-wider text-muted">
                  <th className="px-4 py-3">Member</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">People</th>
                  <th className="px-4 py-3">Intentions</th>
                  <th className="px-4 py-3">Last seen</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.data.map((u) => (
                  <UserRow key={u.id} user={u} isSelf={u.id === me.id} />
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </section>
    </div>
  );
}
